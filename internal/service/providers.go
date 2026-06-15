package service

import "strings"

type ModelProvider struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	IconURL string `json:"icon_url"`
}

var modelProviderPresets = []ModelProvider{
	{ID: "openai", Name: "OpenAI", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg"},
	{ID: "deepseek", Name: "DeepSeek", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/deepseek.svg"},
	{ID: "anthropic", Name: "Anthropic", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/anthropic.svg"},
	{ID: "google", Name: "Google", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/google.svg"},
	{ID: "meta", Name: "Meta", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/meta.svg"},
	{ID: "mistral", Name: "Mistral AI", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/mistralai.svg"},
	{ID: "qwen", Name: "Qwen", IconURL: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/alibabacloud.svg"},
	{ID: "moonshot", Name: "Moonshot AI", IconURL: ""},
	{ID: "zhipu", Name: "Zhipu AI", IconURL: ""},
	{ID: "custom", Name: "Custom", IconURL: ""},
}

func ModelProviderPresets() []ModelProvider {
	presets := make([]ModelProvider, len(modelProviderPresets))
	copy(presets, modelProviderPresets)
	return presets
}

func ResolveModelProvider(modelName, provider, customIconURL string) ModelProvider {
	provider = strings.TrimSpace(provider)
	customIconURL = strings.TrimSpace(customIconURL)
	if provider == "" {
		provider = InferModelProvider(modelName)
	}

	if preset, ok := ModelProviderPreset(provider); ok {
		if customIconURL != "" {
			preset.IconURL = customIconURL
		}
		return preset
	}

	return ModelProvider{
		ID:      provider,
		Name:    provider,
		IconURL: customIconURL,
	}
}

func ModelProviderPreset(provider string) (ModelProvider, bool) {
	normalized := normalizeProvider(provider)
	for _, preset := range modelProviderPresets {
		if preset.ID == normalized || normalizeProvider(preset.Name) == normalized {
			return preset, true
		}
	}
	return ModelProvider{}, false
}

func InferModelProvider(modelName string) string {
	name := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case strings.Contains(name, "deepseek"):
		return "deepseek"
	case strings.Contains(name, "claude"):
		return "anthropic"
	case strings.Contains(name, "gemini"), strings.Contains(name, "palm"), strings.Contains(name, "bison"):
		return "google"
	case strings.Contains(name, "llama"):
		return "meta"
	case strings.Contains(name, "mistral"), strings.Contains(name, "mixtral"), strings.Contains(name, "codestral"):
		return "mistral"
	case strings.Contains(name, "qwen"), strings.Contains(name, "qwq"):
		return "qwen"
	case strings.Contains(name, "kimi"), strings.Contains(name, "moonshot"):
		return "moonshot"
	case strings.Contains(name, "glm"), strings.Contains(name, "zhipu"):
		return "zhipu"
	case strings.Contains(name, "gpt"), strings.Contains(name, "dall-e"), strings.Contains(name, "dalle"), strings.Contains(name, "o1"), strings.Contains(name, "o3"), strings.Contains(name, "o4"):
		return "openai"
	default:
		return "custom"
	}
}

func normalizeProvider(provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	provider = strings.ReplaceAll(provider, " ", "")
	provider = strings.ReplaceAll(provider, "-", "")
	provider = strings.ReplaceAll(provider, "_", "")
	return provider
}
