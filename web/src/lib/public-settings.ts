export interface PublicSettings {
  site_name: string
  base_url: string
  icon_url: string
  footer_text: string
  about_html: string
  home_iframe_url: string
  privacy_policy: string
  terms: string
  announcement: string
  top_nav_enabled: boolean
  top_nav_items: string
  sidebar_dashboard_enabled: boolean
  sidebar_usage_enabled: boolean
  sidebar_api_keys_enabled: boolean
  sidebar_chat_enabled: boolean
  sidebar_images_enabled: boolean
  sidebar_settings_enabled: boolean
  sidebar_system_enabled: boolean
  sidebar_admin_overview_enabled: boolean
  sidebar_channels_enabled: boolean
  sidebar_models_enabled: boolean
  sidebar_users_enabled: boolean
  referral_enabled: boolean
  referral_commission_rate: string
  group_multiplier_mode: string
  pricing_endpoint_enabled: boolean
  status_monitor_enabled: boolean
  checkin_enabled: boolean
  checkin_daily_reward: string
  checkin_random_enabled: boolean
  checkin_random_min: string
  checkin_random_max: string
  payment_enabled: boolean
  payment_currency_display_name: string
  payment_usd_to_rmb_rate: string
  payment_min_recharge_amount: string
  payment_recharge_presets: string
  payment_methods: string
  oidc_enabled: boolean
  passkey_enabled: boolean
  password_login_enabled: boolean
  password_registration_enabled: boolean
  password_hcaptcha_enabled: boolean
  hcaptcha_site_key: string
  email_verification_required: boolean
}

export const defaultPublicSettings: PublicSettings = {
  site_name: "flai",
  base_url: "",
  icon_url: "",
  footer_text: "",
  about_html: "",
  home_iframe_url: "",
  privacy_policy: "",
  terms: "",
  announcement: "",
  top_nav_enabled: false,
  top_nav_items: "",
  sidebar_dashboard_enabled: true,
  sidebar_usage_enabled: true,
  sidebar_api_keys_enabled: true,
  sidebar_chat_enabled: true,
  sidebar_images_enabled: true,
  sidebar_settings_enabled: true,
  sidebar_system_enabled: true,
  sidebar_admin_overview_enabled: true,
  sidebar_channels_enabled: true,
  sidebar_models_enabled: true,
  sidebar_users_enabled: true,
  referral_enabled: false,
  referral_commission_rate: "0",
  group_multiplier_mode: "min",
  pricing_endpoint_enabled: false,
  status_monitor_enabled: false,
  checkin_enabled: false,
  checkin_daily_reward: "0",
  checkin_random_enabled: false,
  checkin_random_min: "0",
  checkin_random_max: "0",
  payment_enabled: false,
  payment_currency_display_name: "$",
  payment_usd_to_rmb_rate: "7.20",
  payment_min_recharge_amount: "1",
  payment_recharge_presets: "[\"5\",\"10\",\"20\",\"50\",\"100\"]",
  payment_methods: "[\"alipay\",\"wxpay\"]",
  oidc_enabled: false,
  passkey_enabled: false,
  password_login_enabled: true,
  password_registration_enabled: true,
  password_hcaptcha_enabled: false,
  hcaptcha_site_key: "",
  email_verification_required: false,
}

export function withPublicSettingsDefaults(settings?: Partial<PublicSettings>): PublicSettings {
  return { ...defaultPublicSettings, ...(settings || {}) }
}

export interface TopNavItem {
  label: string
  href: string
  external: boolean
}

export function parseTopNavItems(raw: string): TopNavItem[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((part) => part.trim())
      if (!label || !href) {
        return null
      }
      return { label, href, external: /^https?:\/\//i.test(href) }
    })
    .filter((item): item is TopNavItem => Boolean(item))
}
