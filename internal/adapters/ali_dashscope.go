package adapters

import (
	"net/http"
	"strings"
)

type AliDashScope struct{}

func (AliDashScope) Types() []string {
	return []string{"ali", "dashscope", "qwen", "aliyun"}
}

func (AliDashScope) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (AliDashScope) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointChat:
		return "/compatible-mode/v1/chat/completions", true
	case EndpointResponses:
		return "/api/v2/apps/protocols/compatible-mode/v1/responses", true
	case EndpointClaudeMessages:
		return "/apps/anthropic/v1/messages", true
	case EndpointImageGeneration:
		return "/api/v1/services/aigc/text2image/image-synthesis", true
	case EndpointImageEdit:
		return "/api/v1/services/aigc/image2image/image-synthesis", true
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (AliDashScope) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	headers := baseAdapter.Headers(apiKey, protocol, stream)
	if stream {
		headers.Set("X-DashScope-SSE", "enable")
	}
	return headers
}

func (AliDashScope) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	switch endpoint {
	case EndpointChat:
		if stream, _ := payload["stream"].(bool); stream {
			options, _ := payload["stream_options"].(map[string]interface{})
			if options == nil {
				options = map[string]interface{}{}
			}
			options["include_usage"] = true
			payload["stream_options"] = options
		}
	case EndpointClaudeMessages:
		model, _ := payload["model"].(string)
		if !aliSupportsClaudeMessages(model) {
			delete(payload, "system")
		}
	}
}

func aliSupportsClaudeMessages(model string) bool {
	model = strings.ToLower(strings.TrimSpace(model))
	for _, pattern := range []string{"qwen", "deepseek-v4", "kimi", "glm", "minimax-m"} {
		if strings.Contains(model, pattern) {
			return true
		}
	}
	return false
}
