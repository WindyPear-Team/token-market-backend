package adapters

import "net/http"

type SiliconFlow struct{}

func (SiliconFlow) Types() []string {
	return []string{"siliconflow", "silicon_flow"}
}

func (SiliconFlow) Protocol(string) Protocol {
	return ProtocolOpenAI
}

func (SiliconFlow) Path(endpoint Endpoint, model string) (string, bool) {
	if endpoint == EndpointResponses {
		return "", false
	}
	return baseAdapter.Path(endpoint, model)
}

func (SiliconFlow) Headers(apiKey string, protocol Protocol, stream bool) http.Header {
	return baseAdapter.Headers(apiKey, protocol, stream)
}

func (SiliconFlow) ApplyPayload(endpoint Endpoint, payload map[string]interface{}) {
	switch endpoint {
	case EndpointChat:
		if _, hasMessages := payload["messages"]; !hasMessages {
			if _, hasPrefix := payload["prefix"]; hasPrefix {
				payload["messages"] = []map[string]interface{}{{"role": "user", "content": ""}}
			} else if _, hasSuffix := payload["suffix"]; hasSuffix {
				payload["messages"] = []map[string]interface{}{{"role": "user", "content": ""}}
			}
		}
	case EndpointImageGeneration:
		if size, exists := payload["size"]; exists {
			if _, hasImageSize := payload["image_size"]; !hasImageSize {
				payload["image_size"] = size
			}
			delete(payload, "size")
		}
		if n, exists := payload["n"]; exists {
			if _, hasBatchSize := payload["batch_size"]; !hasBatchSize {
				payload["batch_size"] = n
			}
			delete(payload, "n")
		}
	}
}
