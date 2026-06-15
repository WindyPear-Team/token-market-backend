//go:build !premium

package service

import (
	"errors"
	"net"
	"net/url"
	"strings"
)

var ErrUnsafeURL = errors.New("target URL is blocked by SSRF protection")

type URLGuardOptions struct {
	AllowPrivateNetworks bool
	AllowedHosts         []string
	Resolve              bool
}

func ValidateConfiguredHTTPURL(raw string) error {
	return validateHTTPURLSyntax(raw)
}

func ValidateConfiguredTCPAddress(raw string) error {
	_, _, err := net.SplitHostPort(strings.TrimSpace(raw))
	return err
}

func ValidateConfiguredStatusTarget(target string, checkType string) error {
	if strings.EqualFold(strings.TrimSpace(checkType), StatusCheckTCP) {
		address, err := statusTCPGuardAddress(target)
		if err != nil {
			return err
		}
		return ValidateConfiguredTCPAddress(address)
	}
	return ValidateConfiguredHTTPURL(target)
}

func statusTCPGuardAddress(target string) (string, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return "", errors.New("tcp target is required")
	}
	defaultPort := ""
	if parsed, err := url.Parse(target); err == nil && parsed.Host != "" {
		target = parsed.Host
		switch parsed.Scheme {
		case "http":
			defaultPort = "80"
		case "https":
			defaultPort = "443"
		}
	}
	if _, _, err := net.SplitHostPort(target); err == nil {
		return target, nil
	}
	if defaultPort == "" {
		return "", errors.New("tcp target must include a port")
	}
	return net.JoinHostPort(target, defaultPort), nil
}

func ValidateOutboundHTTPURL(raw string, options URLGuardOptions) error {
	return validateHTTPURLSyntax(raw)
}

func CurrentURLGuardOptions() URLGuardOptions {
	return URLGuardOptions{}
}

func SSRFProtectionEnabled() bool {
	return false
}

func validateHTTPURLSyntax(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("invalid URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("URL must use http or https")
	}
	return nil
}
