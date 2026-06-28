package adapters

import (
	"net/http"
	"net/url"
)

type openAICompatible struct {
	names []string
}

func (adapter openAICompatible) Types() []string {
	return adapter.names
}

func (adapter openAICompatible) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (adapter openAICompatible) Path(endpoint Endpoint, model string) (string, bool) {
	if endpoint == EndpointResponses {
		return "", false
	}
	return baseAdapter.Path(endpoint, model)
}

func (adapter openAICompatible) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (adapter openAICompatible) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {}

type OpenRouter struct{ openAICompatible }
type Perplexity struct{ openAICompatible }
type LingYiWanWu struct{ openAICompatible }
type MokaAI struct{ openAICompatible }
type Xinference struct{ openAICompatible }
type Submodel struct{ openAICompatible }
type Ollama struct{ openAICompatible }
type Mistral struct{ openAICompatible }
type BaiduV2 struct{ openAICompatible }
type MiniMax struct{ openAICompatible }
type VolcEngine struct{ openAICompatible }

func (OpenRouter) Types() []string  { return []string{"openrouter", "open_router"} }
func (Perplexity) Types() []string  { return []string{"perplexity"} }
func (LingYiWanWu) Types() []string { return []string{"lingyiwanwu", "lingyi", "01ai", "yi"} }
func (MokaAI) Types() []string      { return []string{"mokaai", "moka"} }
func (Xinference) Types() []string  { return []string{"xinference"} }
func (Submodel) Types() []string    { return []string{"submodel"} }
func (Ollama) Types() []string      { return []string{"ollama"} }
func (Mistral) Types() []string     { return []string{"mistral"} }
func (BaiduV2) Types() []string     { return []string{"baidu_v2", "qianfan", "qianfan_v2"} }
func (MiniMax) Types() []string     { return []string{"minimax", "hailuo"} }
func (VolcEngine) Types() []string  { return []string{"volcengine", "volc", "doubao", "ark"} }

func (MiniMax) Path(endpoint Endpoint, model string) (string, bool) {
	switch endpoint {
	case EndpointClaudeMessages:
		return "/v1/text/chatcompletion_v2", true
	case EndpointResponses:
		return "", false
	default:
		return baseAdapter.Path(endpoint, model)
	}
}

func (VolcEngine) Protocol(channelType string) Protocol {
	switch NormalizeType(channelType) {
	case "veo", "seedance", "openai_video", "video":
		return ProtocolOpenAIVideo
	default:
		return ProtocolOpenAI
	}
}

func pathEscape(value string) string {
	return url.PathEscape(value)
}
