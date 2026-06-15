export function passkeySupported() {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential && navigator.credentials)
}

export function preparePasskeyCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  const publicKey = { ...(options?.publicKey || {}) }
  publicKey.challenge = base64URLToBuffer(publicKey.challenge)
  if (publicKey.user?.id) {
    publicKey.user = { ...publicKey.user, id: base64URLToBuffer(publicKey.user.id) }
  }
  if (Array.isArray(publicKey.excludeCredentials) && publicKey.excludeCredentials.length > 0) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((item: any) => ({
      ...item,
      id: base64URLToBuffer(item.id),
    }))
  } else {
    delete publicKey.excludeCredentials
  }
  return publicKey as PublicKeyCredentialCreationOptions
}

export function preparePasskeyRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  const publicKey = { ...(options?.publicKey || {}) }
  publicKey.challenge = base64URLToBuffer(publicKey.challenge)
  if (Array.isArray(publicKey.allowCredentials) && publicKey.allowCredentials.length > 0) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((item: any) => ({
      ...item,
      id: base64URLToBuffer(item.id),
    }))
  } else {
    delete publicKey.allowCredentials
  }
  return publicKey as PublicKeyCredentialRequestOptions
}

export function passkeyCredentialToJSON(credential: Credential | null) {
  if (!credential) {
    return null
  }
  const publicKeyCredential = credential as PublicKeyCredential
  const response = publicKeyCredential.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse
  const payload: Record<string, any> = {
    id: publicKeyCredential.id,
    rawId: bufferToBase64URL(publicKeyCredential.rawId),
    type: publicKeyCredential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
    },
  }
  if ("attestationObject" in response) {
    payload.response.attestationObject = bufferToBase64URL(response.attestationObject)
  }
  if ("authenticatorData" in response) {
    payload.response.authenticatorData = bufferToBase64URL(response.authenticatorData)
  }
  if ("signature" in response) {
    payload.response.signature = bufferToBase64URL(response.signature)
  }
  if ("userHandle" in response && response.userHandle) {
    payload.response.userHandle = bufferToBase64URL(response.userHandle)
  }
  return payload
}

function base64URLToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function bufferToBase64URL(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
