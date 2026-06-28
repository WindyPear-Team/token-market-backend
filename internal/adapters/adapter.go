package adapters

import (
	"net/http"
	"strings"
)

type Protocol string

const (
	ProtocolOpenAI      Protocol = "openai"
	ProtocolResponses   Protocol = "responses"
	ProtocolOpenAIVideo Protocol = "openai-video"
	ProtocolKling       Protocol = "kling"
	ProtocolMidjourney  Protocol = "midjourney"
	ProtocolClaude      Protocol = "claude"
	ProtocolGemini      Protocol = "gemini"
)

type Endpoint string

const (
	EndpointChat            Endpoint = "chat"
	EndpointResponses       Endpoint = "responses"
	EndpointClaudeMessages  Endpoint = "claude_messages"
	EndpointGeminiGenerate  Endpoint = "gemini_generate"
	EndpointImageGeneration Endpoint = "image_generation"
	EndpointImageEdit       Endpoint = "image_edit"
	EndpointVideoGeneration Endpoint = "video_generation"
	EndpointVideoStatus     Endpoint = "video_status"
)

type Adapter interface {
	Types() []string
	Protocol(channelType string) Protocol
	Path(endpoint Endpoint, model string) (string, bool)
	Headers(apiKey string, protocol Protocol, stream bool) http.Header
	ApplyPayload(endpoint Endpoint, payload map[string]interface{})
}

type BaseAdapter struct{}

func (BaseAdapter) Types() []string {
	return nil
}

func (BaseAdapter) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (BaseAdapter) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointChat:
		return "/v1/chat/completions", true
	case EndpointResponses:
		return "/v1/responses", true
	case EndpointClaudeMessages:
		return "/v1/messages", true
	case EndpointGeminiGenerate:
		model = strings.TrimPrefix(strings.TrimSpace(model), "models/")
		if model == "" {
			return "", false
		}
		return "/v1beta/models/" + pathEscape(model) + ":generateContent", true
	case EndpointImageGeneration:
		return "/v1/images/generations", true
	case EndpointImageEdit:
		return "/v1/images/edits", true
	case EndpointVideoGeneration:
		return "/v1/video/generations", true
	case EndpointVideoStatus:
		return "/v1/video/generations/" + pathEscape(model), true
	default:
		return "", false
	}
}

func (BaseAdapter) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	headers := JSONHeaders()
	apiKey = strings.TrimSpace(apiKey)
	switch protocol {
	case ProtocolClaude:
		if apiKey != "" {
			headers.Set("x-api-key", apiKey)
			headers.Set("Authorization", "Bearer "+apiKey)
		}
		headers.Set("anthropic-version", "2023-06-01")
	case ProtocolGemini:
		if apiKey != "" {
			headers.Set("x-goog-api-key", apiKey)
		}
	default:
		if apiKey != "" {
			headers.Set("Authorization", "Bearer "+apiKey)
		}
	}
	return headers
}

func (BaseAdapter) ApplyPayload(Endpoint, map[string]interface{}) {}

var baseAdapter BaseAdapter

var registry = []Adapter{
	OpenAI{},
	Responses{},
	OpenAIVideo{},
	Seedream{},
	Kling{},
	Midjourney{},
	Claude{},
	Gemini{},
	AliDashScope{},
	DeepSeek{},
	Moonshot{},
	ZhipuV4{},
	XAI{},
	SiliconFlow{},
	Mistral{},
	OpenRouter{},
	Perplexity{},
	LingYiWanWu{},
	MokaAI{},
	Xinference{},
	Submodel{},
	Ollama{},
	BaiduV2{},
	MiniMax{},
	VolcEngine{},
}

func For(channelType string) Adapter {
	normalized := NormalizeType(channelType)
	for _, adapter := range registry {
		for _, value := range adapter.Types() {
			if NormalizeType(value) == normalized {
				return adapter
			}
		}
	}
	return baseAdapter
}

func ProtocolFor(channelType string) Protocol {
	return For(channelType).Protocol(channelType)
}

func Path(channelType string, endpoint Endpoint, model string) (string, bool) {
	return For(channelType).Path(endpoint, model)
}

func Headers(channelType string, apiKey string, protocol Protocol, stream bool) http.Header {
	return For(channelType).Headers(apiKey, protocol, stream)
}

func ApplyPayload(channelType string, endpoint Endpoint, payload map[string]interface{}) {
	For(channelType).ApplyPayload(endpoint, payload)
}

func SupportsOpenAIImage(channelType string, protocol Protocol) bool {
	if protocol == ProtocolOpenAI || protocol == ProtocolResponses {
		_, ok := Path(channelType, EndpointImageGeneration, "")
		return ok
	}
	return false
}

func SupportsVideo(protocol Protocol) bool {
	return protocol == ProtocolOpenAIVideo || protocol == ProtocolKling
}

func JSONHeaders() http.Header {
	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("Accept", "application/json")
	return headers
}

func NormalizeType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "")
	value = strings.ReplaceAll(value, "-", "_")
	return value
}

func setFloatBelowOne(payload map[string]interface{}, key string) {
	switch value := payload[key].(type) {
	case float64:
		if value >= 1 {
			payload[key] = 0.99
		}
	case int:
		if value >= 1 {
			payload[key] = 0.99
		}
	}
}
