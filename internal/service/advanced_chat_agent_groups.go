package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/WindyPear-Team/flai/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	advancedChatAgentGroupActionList   = "list_agent_groups"
	advancedChatAgentGroupActionRead   = "read_agent_group"
	advancedChatAgentGroupActionWrite  = "write_agent_group"
	advancedChatAgentGroupActionDelete = "delete_agent_group"

	advancedChatAgentDelegateToolName = "agent_delegate"
	advancedChatAgentSplitToolName    = "agent_split"
	advancedChatAgentGroupsLoadWait   = 20 * time.Second
)

var advancedChatAgentGroupIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)

type advancedChatAgentGroupInput struct {
	ConnectorDeviceID string                   `json:"connector_device_id"`
	ID                string                   `json:"id"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description"`
	Agents            []advancedChatGroupAgent `json:"agents"`
}

type advancedChatAgentGroupDeleteInput struct {
	ConnectorDeviceID string `json:"connector_device_id"`
}

type advancedChatAgentGroup struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description,omitempty"`
	Agents      []advancedChatGroupAgent `json:"agents"`
	UpdatedAt   string                   `json:"updated_at,omitempty"`
}

type advancedChatGroupAgent struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	Prompt        string   `json:"prompt"`
	ChatAgentID   string   `json:"chat_agent_id,omitempty"`
	DefaultModel  string   `json:"default_model,omitempty"`
	UserChannelID uint     `json:"user_channel_id,omitempty"`
	SkillIDs      []string `json:"skill_ids,omitempty"`
	MCPServerIDs  []string `json:"mcp_server_ids,omitempty"`
}

func (api *advancedChatAPI) listAgentGroups(c *gin.Context) {
	user, ok := currentAdvancedChatUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	device, ok := api.loadAgentGroupConnector(c, user.ID, c.Query("connector_device_id"))
	if !ok {
		return
	}
	groups, err := loadAdvancedChatAgentGroupsForRun(c.Request.Context(), user.ID, device)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

func (api *advancedChatAPI) getAgentGroup(c *gin.Context) {
	user, ok := currentAdvancedChatUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	device, ok := api.loadAgentGroupConnector(c, user.ID, c.Query("connector_device_id"))
	if !ok {
		return
	}
	group, err := readAdvancedChatAgentGroup(c.Request.Context(), user.ID, device, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, group)
}

func (api *advancedChatAPI) saveAgentGroup(c *gin.Context) {
	user, ok := currentAdvancedChatUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var input advancedChatAgentGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pathID := strings.TrimSpace(c.Param("id"))
	bodyID := strings.TrimSpace(input.ID)
	if pathID != "" {
		if bodyID != "" && bodyID != pathID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "agent group id does not match path"})
			return
		}
		input.ID = pathID
	} else if bodyID != "" {
		input.ID = bodyID
	}
	device, ok := api.loadAgentGroupConnector(c, user.ID, input.ConnectorDeviceID)
	if !ok {
		return
	}
	group, err := normalizeAdvancedChatAgentGroup(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := writeAdvancedChatAgentGroup(c.Request.Context(), user.ID, device, group); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, group)
}

func (api *advancedChatAPI) deleteAgentGroup(c *gin.Context) {
	user, ok := currentAdvancedChatUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	deviceID := c.Query("connector_device_id")
	if strings.TrimSpace(deviceID) == "" {
		var input advancedChatAgentGroupDeleteInput
		_ = c.ShouldBindJSON(&input)
		deviceID = input.ConnectorDeviceID
	}
	device, ok := api.loadAgentGroupConnector(c, user.ID, deviceID)
	if !ok {
		return
	}
	if err := deleteAdvancedChatAgentGroup(c.Request.Context(), user.ID, device, c.Param("id")); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Agent group deleted"})
}

func (api *advancedChatAPI) loadAgentGroupConnector(c *gin.Context, userID uint, deviceID string) (*AdvancedChatConnectorDevice, bool) {
	device, err := loadAdvancedChatConnectorDeviceOnly(userID, deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Connector device not found"})
			return nil, false
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return nil, false
	}
	return device, true
}

func loadAdvancedChatConnectorDeviceOnly(userID uint, deviceID string) (*AdvancedChatConnectorDevice, error) {
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return nil, errors.New("connector device is required")
	}
	var device AdvancedChatConnectorDevice
	if err := model.DB.Where("id = ? AND user_id = ?", deviceID, userID).First(&device).Error; err != nil {
		return nil, err
	}
	if !advancedChatConnectorDeviceOnline(device) {
		return nil, errors.New("connector device is offline")
	}
	return &device, nil
}

func loadAdvancedChatAgentGroupsForRun(ctx context.Context, userID uint, device *AdvancedChatConnectorDevice) ([]advancedChatAgentGroup, error) {
	if device == nil {
		return []advancedChatAgentGroup{}, nil
	}
	loadCtx, cancel := context.WithTimeout(ctx, advancedChatAgentGroupsLoadWait)
	defer cancel()
	raw, err := callAdvancedChatAgentGroupConnector(loadCtx, userID, device, advancedChatAgentGroupActionList, map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to load connector agent groups: %w", err)
	}
	return parseAdvancedChatAgentGroups(raw)
}

func readAdvancedChatAgentGroup(ctx context.Context, userID uint, device *AdvancedChatConnectorDevice, id string) (advancedChatAgentGroup, error) {
	raw, err := callAdvancedChatAgentGroupConnector(ctx, userID, device, advancedChatAgentGroupActionRead, map[string]interface{}{"id": strings.TrimSpace(id)})
	if err != nil {
		return advancedChatAgentGroup{}, err
	}
	group, err := parseAdvancedChatAgentGroup(raw)
	if err != nil {
		return advancedChatAgentGroup{}, err
	}
	return group, nil
}

func writeAdvancedChatAgentGroup(ctx context.Context, userID uint, device *AdvancedChatConnectorDevice, group advancedChatAgentGroup) error {
	data, err := json.Marshal(group)
	if err != nil {
		return err
	}
	_, err = callAdvancedChatAgentGroupConnector(ctx, userID, device, advancedChatAgentGroupActionWrite, map[string]interface{}{
		"id":      group.ID,
		"content": string(data),
	})
	return err
}

func deleteAdvancedChatAgentGroup(ctx context.Context, userID uint, device *AdvancedChatConnectorDevice, id string) error {
	_, err := callAdvancedChatAgentGroupConnector(ctx, userID, device, advancedChatAgentGroupActionDelete, map[string]interface{}{"id": strings.TrimSpace(id)})
	return err
}

func callAdvancedChatAgentGroupConnector(ctx context.Context, userID uint, device *AdvancedChatConnectorDevice, action string, arguments map[string]interface{}) (string, error) {
	if device == nil {
		return "", errors.New("connector device is required")
	}
	binding := advancedChatConnectorToolBinding{
		DeviceID:   device.ID,
		DeviceName: device.Name,
		Action:     action,
	}
	return callAdvancedChatConnectorTool(ctx, userID, "", binding, arguments)
}

func normalizeAdvancedChatAgentGroup(input advancedChatAgentGroupInput) (advancedChatAgentGroup, error) {
	id := strings.TrimSpace(input.ID)
	if id == "" {
		id = newAdvancedChatID("agp")
	}
	if !advancedChatAgentGroupIDPattern.MatchString(id) {
		return advancedChatAgentGroup{}, errors.New("agent group id must be 1-80 characters of letters, numbers, underscore, or dash")
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return advancedChatAgentGroup{}, errors.New("agent group name is required")
	}
	if len([]rune(name)) > 120 {
		name = string([]rune(name)[:120])
	}
	description := strings.TrimSpace(input.Description)
	if len([]rune(description)) > 2000 {
		description = string([]rune(description)[:2000])
	}
	agents := normalizeAdvancedChatGroupAgents(input.Agents)
	if len(agents) == 0 {
		return advancedChatAgentGroup{}, errors.New("agent group requires at least one agent")
	}
	return advancedChatAgentGroup{
		ID:          id,
		Name:        name,
		Description: description,
		Agents:      agents,
	}, nil
}

func normalizeAdvancedChatGroupAgents(input []advancedChatGroupAgent) []advancedChatGroupAgent {
	result := []advancedChatGroupAgent{}
	seen := map[string]struct{}{}
	for index, agent := range input {
		id := strings.TrimSpace(agent.ID)
		if id == "" {
			id = fmt.Sprintf("agent-%d", index+1)
		}
		id = sanitizeAdvancedChatAgentGroupPart(id, fmt.Sprintf("agent-%d", index+1))
		if _, exists := seen[id]; exists {
			continue
		}
		name := strings.TrimSpace(agent.Name)
		if name == "" {
			name = id
		}
		if len([]rune(name)) > 120 {
			name = string([]rune(name)[:120])
		}
		chatAgentID := truncateAdvancedChatAgentField(agent.ChatAgentID, 80)
		skillIDs := uniqueStringsLocal(agent.SkillIDs)
		mcpServerIDs := uniqueStringsLocal(agent.MCPServerIDs)
		prompt := strings.TrimSpace(agent.Prompt)
		if prompt == "" && chatAgentID == "" && len(skillIDs) == 0 && len(mcpServerIDs) == 0 {
			continue
		}
		if len([]rune(prompt)) > 20000 {
			prompt = string([]rune(prompt)[:20000])
		}
		result = append(result, advancedChatGroupAgent{
			ID:            id,
			Name:          name,
			Type:          normalizeAdvancedChatAgentType(agent.Type),
			Prompt:        prompt,
			ChatAgentID:   chatAgentID,
			DefaultModel:  truncateAdvancedChatAgentField(agent.DefaultModel, 100),
			UserChannelID: agent.UserChannelID,
			SkillIDs:      skillIDs,
			MCPServerIDs:  mcpServerIDs,
		})
		seen[id] = struct{}{}
		if len(result) >= 40 {
			break
		}
	}
	return result
}

func parseAdvancedChatAgentGroups(raw string) ([]advancedChatAgentGroup, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []advancedChatAgentGroup{}, nil
	}
	var payload struct {
		Groups []json.RawMessage `json:"groups"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, err
	}
	groups := make([]advancedChatAgentGroup, 0, len(payload.Groups))
	for _, item := range payload.Groups {
		group, err := parseAdvancedChatAgentGroup(string(item))
		if err != nil || group.ID == "" {
			continue
		}
		groups = append(groups, group)
		if len(groups) >= 100 {
			break
		}
	}
	sort.Slice(groups, func(i, j int) bool {
		return strings.ToLower(groups[i].Name) < strings.ToLower(groups[j].Name)
	})
	return groups, nil
}

func parseAdvancedChatAgentGroup(raw string) (advancedChatAgentGroup, error) {
	var group advancedChatAgentGroup
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &group); err != nil {
		return advancedChatAgentGroup{}, err
	}
	input := advancedChatAgentGroupInput{
		ID:          group.ID,
		Name:        group.Name,
		Description: group.Description,
		Agents:      group.Agents,
	}
	normalized, err := normalizeAdvancedChatAgentGroup(input)
	if err != nil {
		return advancedChatAgentGroup{}, err
	}
	normalized.UpdatedAt = strings.TrimSpace(group.UpdatedAt)
	return normalized, nil
}

func sanitizeAdvancedChatAgentGroupPart(value string, fallback string) string {
	value = strings.TrimSpace(value)
	var builder strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			builder.WriteRune(r)
		}
	}
	result := builder.String()
	if result == "" {
		result = fallback
	}
	if len(result) > 80 {
		result = result[:80]
	}
	return result
}

func normalizeAdvancedChatAgentType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "chief", "worker", "critic", "reviewer":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "worker"
	}
}

func advancedChatAgentTypeSystemPrompt(agentType string) string {
	switch normalizeAdvancedChatAgentType(agentType) {
	case "chief":
		return "Role: chief agent. Coordinate the work, decompose goals, delegate to suitable agents when useful, integrate results, and keep final decisions coherent."
	case "critic":
		return "Role: critic agent. Stress-test assumptions, identify flaws, missing evidence, unsafe steps, and weak reasoning. Return concrete corrections and risks."
	case "reviewer":
		return "Role: reviewer agent. Review completed work for correctness, regressions, quality, maintainability, and test gaps. Prefer actionable findings over broad summaries."
	default:
		return "Role: worker agent. Execute the assigned goal directly, use tools when needed, report concrete results, and avoid taking ownership of unrelated work."
	}
}

func truncateAdvancedChatAgentField(value string, max int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= max {
		return value
	}
	return string([]rune(value)[:max])
}

func advancedChatAgentDelegateTool(groups []advancedChatAgentGroup) ChatExecutorTool {
	return ChatExecutorTool{
		Name:        advancedChatAgentDelegateToolName,
		Description: "Delegate a focused goal to an existing agent from the loaded connector agent group. This is CPS-style delegation: the current agent waits until the selected agent returns a result. You may call this tool multiple times in the same assistant turn when several existing agents should work on separate goals.",
		Schema: map[string]interface{}{
			"type":     "object",
			"required": []string{"group_id", "agent_id", "goal"},
			"properties": map[string]interface{}{
				"group_id": map[string]interface{}{"type": "string", "description": "Agent group id."},
				"agent_id": map[string]interface{}{"type": "string", "description": "Agent id inside the group. Use an existing agent, not a newly split agent."},
				"goal":     map[string]interface{}{"type": "string", "description": "Specific task goal for the delegated agent."},
				"context":  map[string]interface{}{"type": "string", "description": "Optional extra context or constraints for this delegated task."},
			},
		},
	}
}

func advancedChatAgentSplitTool() ChatExecutorTool {
	return ChatExecutorTool{
		Name:        advancedChatAgentSplitToolName,
		Description: "Split the current assistant into one or more temporary sibling agents that share the same conversation history but each receive a different focused goal. This is not CPS delegation to an agent group; use agent_delegate when you need a defined agent from a connector group.",
		Schema: map[string]interface{}{
			"type":     "object",
			"required": []string{"tasks"},
			"properties": map[string]interface{}{
				"tasks": map[string]interface{}{
					"type":        "array",
					"description": "Temporary split-agent tasks. Keep each task independent and focused.",
					"minItems":    1,
					"maxItems":    8,
					"items": map[string]interface{}{
						"type":     "object",
						"required": []string{"goal"},
						"properties": map[string]interface{}{
							"id":      map[string]interface{}{"type": "string", "description": "Optional caller-defined task id."},
							"goal":    map[string]interface{}{"type": "string", "description": "Focused goal for this split agent."},
							"context": map[string]interface{}{"type": "string", "description": "Optional extra context or constraints for this task."},
						},
					},
				},
			},
		},
	}
}

func advancedChatAgentGroupSystemPrompt(groups []advancedChatAgentGroup) string {
	if len(groups) == 0 {
		return ""
	}
	lines := []string{
		"Connector agent groups are available for CPS-style delegation.",
		"Use agent_delegate when a task should be handled by an existing agent in a group. Do not treat CPS delegation as agent splitting; choose one of the defined agents by group_id and agent_id.",
		"Available agent groups:",
	}
	for _, group := range groups {
		lines = append(lines, "- group_id: "+group.ID+"; name: "+group.Name)
		for _, agent := range group.Agents {
			lines = append(lines, "  - agent_id: "+agent.ID+"; type: "+agent.Type+"; name: "+agent.Name)
		}
	}
	return strings.Join(lines, "\n")
}

func advancedChatAgentSplitSystemPrompt() string {
	return strings.TrimSpace(`Use agent_split when the current task can be divided into independent temporary sibling-agent tasks that share this conversation history.
Use agent_delegate instead when you need a specific existing agent from a connector agent group.
You may call agent_split with several tasks at once. Each split agent returns a result to you; you remain responsible for combining the results and producing the final answer.`)
}

type advancedChatAgentDelegateInput struct {
	UserID             uint
	RunID              string
	SessionID          string
	ToolCallID         string
	ModelName          string
	UserChannelID      uint
	Messages           []ChatExecutorMessage
	WorkspaceSkills    []advancedChatWorkspaceSkill
	ConnectorDevice    *AdvancedChatConnectorDevice
	ConnectorWorkspace string
	ConnectorBindings  map[string]advancedChatConnectorToolBinding
	ConnectorTools     []ChatExecutorTool
	Groups             []advancedChatAgentGroup
	Arguments          map[string]interface{}
}

func executeAdvancedChatAgentDelegate(ctx context.Context, user *model.User, input advancedChatAgentDelegateInput) (string, error) {
	if user == nil {
		return "", errors.New("user is required")
	}
	groupID := strings.TrimSpace(stringFromMap(input.Arguments, "group_id"))
	agentID := strings.TrimSpace(stringFromMap(input.Arguments, "agent_id"))
	goal := strings.TrimSpace(stringFromMap(input.Arguments, "goal"))
	extraContext := strings.TrimSpace(stringFromMap(input.Arguments, "context"))
	if groupID == "" || agentID == "" || goal == "" {
		return "", errors.New("group_id, agent_id, and goal are required")
	}
	group, agent, ok := findAdvancedChatGroupAgent(input.Groups, groupID, agentID)
	if !ok {
		return "", errors.New("agent was not found in connector agent groups")
	}
	taskID := newAdvancedChatID("agt")
	appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{
		"task_id":       taskID,
		"parent_id":     strings.TrimSpace(input.ToolCallID),
		"kind":          "cps",
		"status":        "running",
		"group_id":      group.ID,
		"group_name":    group.Name,
		"agent_id":      agent.ID,
		"agent_name":    agent.Name,
		"agent_type":    normalizeAdvancedChatAgentType(agent.Type),
		"goal":          goal,
		"chat_agent_id": strings.TrimSpace(agent.ChatAgentID),
	})
	chatAgent, err := loadAdvancedChatAgent(user.ID, agent.ChatAgentID)
	if err != nil {
		appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error()})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("referenced chat agent was not found")
		}
		return "", err
	}
	skills, err := loadAdvancedChatSkills(user.ID, agent.SkillIDs)
	if err != nil {
		appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error()})
		return "", err
	}
	if len(skills) != len(uniqueStringsLocal(agent.SkillIDs)) {
		appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": "referenced skill was not found"})
		return "", errors.New("referenced skill was not found")
	}
	serverIDs := uniqueStringsLocal(append(agent.MCPServerIDs, skillMCPIDs(skills)...))
	servers := []AdvancedChatMCPServer{}
	if len(serverIDs) > 0 {
		if !advancedChatAssistantMCPToolsEnabled() {
			return "", errors.New("mcp tools are disabled")
		}
		servers, err = loadAdvancedChatMCPServersForCall(user.ID, serverIDs)
		if err != nil {
			appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error()})
			return "", err
		}
	}
	modelName := strings.TrimSpace(agent.DefaultModel)
	if modelName == "" && chatAgent != nil {
		modelName = strings.TrimSpace(chatAgent.DefaultModel)
	}
	if modelName == "" {
		modelName = strings.TrimSpace(input.ModelName)
	}
	if modelName == "" {
		appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": "model is required for delegated agent"})
		return "", errors.New("model is required for delegated agent")
	}
	systemParts := []string{
		"You are running as a delegated CPS agent. Complete only the delegated goal and return a concise result to the caller agent.",
		"Agent group: " + group.Name + " (" + group.ID + ")",
		"Agent: " + agent.Name + " (" + agent.ID + "), type: " + agent.Type,
		advancedChatAgentTypeSystemPrompt(agent.Type),
	}
	if prompt := buildAdvancedChatCompletionSystemPrompt(chatAgent, skills, input.WorkspaceSkills, advancedChatModeAssistant); strings.TrimSpace(prompt) != "" {
		systemParts = append(systemParts, prompt)
	}
	if prompt := strings.TrimSpace(agent.Prompt); prompt != "" {
		systemParts = append(systemParts, prompt)
	}
	if prompt := advancedChatConnectorSystemPrompt(input.ConnectorDevice, input.ConnectorWorkspace); strings.TrimSpace(prompt) != "" {
		systemParts = append(systemParts, prompt)
	}
	messages := append([]ChatExecutorMessage{}, input.Messages...)
	taskText := "Delegated goal:\n" + goal
	if extraContext != "" {
		taskText += "\n\nAdditional context:\n" + extraContext
	}
	messages = append(messages, ChatExecutorMessage{Role: "user", Content: taskText})
	userChannelID := input.UserChannelID
	if agent.UserChannelID > 0 {
		userChannelID = agent.UserChannelID
	}
	tools := append([]ChatExecutorTool{}, input.ConnectorTools...)
	mcpBindings := map[string]mcpToolBinding{}
	if len(servers) > 0 {
		mcpTools, bindings, err := listAdvancedChatMCPTools(ctx, servers)
		if err != nil {
			appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error()})
			return "", fmt.Errorf("failed to load delegated MCP tools: %w", err)
		}
		tools = append(mcpTools, tools...)
		mcpBindings = bindings
	}
	result, err := runAdvancedChatDelegatedAgentLoop(ctx, user, modelName, userChannelID, strings.Join(nonEmptyStrings(systemParts), "\n\n"), messages, tools, mcpBindings, input.ConnectorBindings, input.RunID)
	if err != nil {
		appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error(), "result": truncateToolResult(result)})
		return result, err
	}
	appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "completed", "result": truncateToolResult(result)})
	return result, nil
}

func runAdvancedChatDelegatedAgentLoop(ctx context.Context, user *model.User, modelName string, userChannelID uint, system string, messages []ChatExecutorMessage, tools []ChatExecutorTool, mcpBindings map[string]mcpToolBinding, connectorBindings map[string]advancedChatConnectorToolBinding, runID string) (string, error) {
	executorMessages := append([]ChatExecutorMessage{}, messages...)
	lastContent := ""
	for round := 0; round < 6; round++ {
		result, err := executeAdvancedChatModelRequestWithRetry(ctx, user, ChatExecutorRequest{
			Context:       ctx,
			ModelName:     modelName,
			UserChannelID: userChannelID,
			Messages:      executorMessages,
			System:        system,
			Tools:         tools,
			MaxTokens:     0,
		}, advancedChatCompletionObserver{}, func() bool { return true })
		if err != nil {
			return strings.TrimSpace(lastContent), err
		}
		lastContent = result.Content
		if len(result.ToolCalls) == 0 {
			return strings.TrimSpace(result.Content), nil
		}
		executorMessages = append(executorMessages, ChatExecutorMessage{
			Role:      "assistant",
			Content:   result.Content,
			ToolCalls: normalizeAssistantToolCalls(result.AssistantMessage),
		})
		for _, call := range result.ToolCalls {
			mcpBinding, mcpExists := mcpBindings[call.Name]
			connectorBinding, connectorExists := connectorBindings[call.Name]
			toolResult := "Tool not found for delegated agent: " + call.Name
			arguments, parseErr := parseToolArguments(call.Arguments)
			if !mcpExists && !connectorExists {
				// Delegated agents deliberately do not get agent_delegate again.
			} else if parseErr != nil {
				toolResult = "Invalid tool arguments: " + parseErr.Error()
			} else if mcpExists {
				value, err := mcpBinding.Client.callTool(ctx, mcpBinding.Tool.Name, arguments)
				if err != nil {
					toolResult = "MCP tool failed: " + err.Error()
				} else {
					toolResult = value.Text
					if value.IsError {
						toolResult = "MCP tool returned an error: " + toolResult
					}
				}
			} else {
				value, err := callAdvancedChatConnectorToolExpanded(ctx, user.ID, runID, connectorBinding, arguments)
				if err != nil {
					toolResult = "Connector tool failed: " + err.Error()
					if strings.TrimSpace(value) != "" {
						toolResult = strings.TrimSpace(value) + "\n\n" + toolResult
					}
				} else {
					toolResult = value
				}
			}
			executorMessages = append(executorMessages, ChatExecutorMessage{
				Role:       "tool",
				Content:    truncateToolResult(toolResult),
				ToolCallID: call.ID,
				Name:       call.Name,
			})
		}
	}
	if strings.TrimSpace(lastContent) == "" {
		return "", errors.New("delegated agent reached the tool round limit without a final result")
	}
	return strings.TrimSpace(lastContent), nil
}

type advancedChatAgentSplitInput struct {
	RunID             string
	SessionID         string
	ToolCallID        string
	ModelName         string
	UserChannelID     uint
	SystemPrompt      string
	Messages          []ChatExecutorMessage
	Tools             []ChatExecutorTool
	MCPBindings       map[string]mcpToolBinding
	ConnectorBindings map[string]advancedChatConnectorToolBinding
	Arguments         map[string]interface{}
}

func executeAdvancedChatAgentSplit(ctx context.Context, user *model.User, input advancedChatAgentSplitInput) (string, error) {
	if user == nil {
		return "", errors.New("user is required")
	}
	tasks := parseAdvancedChatSplitTasks(input.Arguments)
	if len(tasks) == 0 {
		return "", errors.New("tasks are required")
	}
	results := make([]map[string]string, len(tasks))
	var wg sync.WaitGroup
	for index, task := range tasks {
		wg.Add(1)
		go func(index int, task advancedChatSplitTask) {
			defer wg.Done()
			taskID := newAdvancedChatID("agt")
			label := strings.TrimSpace(task.ID)
			if label == "" {
				label = fmt.Sprintf("split-%d", index+1)
			}
			appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{
				"task_id":    taskID,
				"parent_id":  strings.TrimSpace(input.ToolCallID),
				"kind":       "split",
				"status":     "running",
				"agent_id":   label,
				"agent_name": label,
				"agent_type": "worker",
				"goal":       task.Goal,
			})
			messages := append([]ChatExecutorMessage{}, input.Messages...)
			taskText := "Split agent goal:\n" + task.Goal
			if strings.TrimSpace(task.Context) != "" {
				taskText += "\n\nAdditional context:\n" + strings.TrimSpace(task.Context)
			}
			messages = append(messages, ChatExecutorMessage{Role: "user", Content: taskText})
			system := strings.Join(nonEmptyStrings([]string{
				input.SystemPrompt,
				"You are a temporary split worker agent. Work only on the split goal and return a concise result to the caller agent.",
				advancedChatAgentTypeSystemPrompt("worker"),
			}), "\n\n")
			result, err := runAdvancedChatDelegatedAgentLoop(ctx, user, input.ModelName, input.UserChannelID, system, messages, input.Tools, input.MCPBindings, input.ConnectorBindings, input.RunID)
			if err != nil {
				appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "error", "error": err.Error(), "result": truncateToolResult(result)})
				results[index] = map[string]string{"id": label, "status": "error", "error": err.Error(), "result": strings.TrimSpace(result)}
				return
			}
			appendAdvancedChatAgentTaskEvent(input.RunID, input.SessionID, user.ID, gin.H{"task_id": taskID, "status": "completed", "result": truncateToolResult(result)})
			results[index] = map[string]string{"id": label, "status": "completed", "result": strings.TrimSpace(result)}
		}(index, task)
	}
	wg.Wait()
	data, err := json.Marshal(results)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

type advancedChatSplitTask struct {
	ID      string
	Goal    string
	Context string
}

func parseAdvancedChatSplitTasks(arguments map[string]interface{}) []advancedChatSplitTask {
	raw, ok := arguments["tasks"].([]interface{})
	if !ok {
		return nil
	}
	tasks := []advancedChatSplitTask{}
	for _, item := range raw {
		row, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		goal := strings.TrimSpace(stringFromMap(row, "goal"))
		if goal == "" {
			continue
		}
		tasks = append(tasks, advancedChatSplitTask{
			ID:      truncateAdvancedChatAgentField(stringFromMap(row, "id"), 80),
			Goal:    truncateAdvancedChatAgentField(goal, 4000),
			Context: truncateAdvancedChatAgentField(stringFromMap(row, "context"), 4000),
		})
		if len(tasks) >= 8 {
			break
		}
	}
	return tasks
}

func appendAdvancedChatAgentTaskEvent(runID string, sessionID string, userID uint, payload gin.H) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		var run AdvancedChatRun
		if err := model.DB.Select("session_id").Where("id = ? AND user_id = ?", runID, userID).First(&run).Error; err != nil {
			return
		}
		sessionID = run.SessionID
	}
	_ = appendAdvancedChatRunEvent(runID, sessionID, userID, "agent_task", payload)
}

func findAdvancedChatGroupAgent(groups []advancedChatAgentGroup, groupID string, agentID string) (advancedChatAgentGroup, advancedChatGroupAgent, bool) {
	for _, group := range groups {
		if group.ID != groupID {
			continue
		}
		for _, agent := range group.Agents {
			if agent.ID == agentID {
				return group, agent, true
			}
		}
	}
	return advancedChatAgentGroup{}, advancedChatGroupAgent{}, false
}

func nonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		if text := strings.TrimSpace(value); text != "" {
			result = append(result, text)
		}
	}
	return result
}
