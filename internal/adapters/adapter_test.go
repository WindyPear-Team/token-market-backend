package adapters

import "testing"

func TestLegacyProtocols(t *testing.T) {
	tests := map[string]Protocol{
		"responses":        ProtocolResponses,
		"openai-video":     ProtocolOpenAIVideo,
		"seedance":         ProtocolOpenAIVideo,
		"seedream":         ProtocolOpenAI,
		"kling":            ProtocolKling,
		"kling_ai":         ProtocolKling,
		"midjourney":       ProtocolMidjourney,
		"mj":               ProtocolMidjourney,
		"claude":           ProtocolClaude,
		"anthropic":        ProtocolClaude,
		"gemini":           ProtocolGemini,
		"google":           ProtocolGemini,
		"chat_completions": ProtocolOpenAI,
	}

	for channelType, want := range tests {
		if got := ProtocolFor(channelType); got != want {
			t.Fatalf("ProtocolFor(%q) = %q, want %q", channelType, got, want)
		}
	}
}

func TestRefChannelProtocols(t *testing.T) {
	tests := map[string]Protocol{
		"openrouter":  ProtocolOpenAI,
		"moonshot":    ProtocolOpenAI,
		"zhipu_v4":    ProtocolOpenAI,
		"deepseek":    ProtocolOpenAI,
		"xai":         ProtocolOpenAI,
		"mistral":     ProtocolOpenAI,
		"siliconflow": ProtocolOpenAI,
		"ollama":      ProtocolOpenAI,
		"qianfan_v2":  ProtocolOpenAI,
		"volcengine":  ProtocolOpenAI,
	}

	for channelType, want := range tests {
		if got := ProtocolFor(channelType); got != want {
			t.Fatalf("ProtocolFor(%q) = %q, want %q", channelType, got, want)
		}
	}
}

func TestProviderSpecificPaths(t *testing.T) {
	tests := []struct {
		channelType string
		endpoint    Endpoint
		want        string
	}{
		{channelType: "zhipu_v4", endpoint: EndpointChat, want: "/api/paas/v4/chat/completions"},
		{channelType: "deepseek", endpoint: EndpointClaudeMessages, want: "/anthropic/v1/messages"},
		{channelType: "moonshot", endpoint: EndpointClaudeMessages, want: "/anthropic/v1/messages"},
		{channelType: "dashscope", endpoint: EndpointChat, want: "/compatible-mode/v1/chat/completions"},
		{channelType: "kling", endpoint: EndpointVideoGeneration, want: "/v1/videos/image2video"},
	}

	for _, tt := range tests {
		got, ok := Path(tt.channelType, tt.endpoint, "model")
		if !ok {
			t.Fatalf("Path(%q, %q) was not supported", tt.channelType, tt.endpoint)
		}
		if got != tt.want {
			t.Fatalf("Path(%q, %q) = %q, want %q", tt.channelType, tt.endpoint, got, tt.want)
		}
	}
}
