import { Episode, MediaAssetType, Series, SeriesProject, Shot } from '../types'
import type { AssetLibraryConfig, VolcengineTosConfig } from '../types/model'
import { getAssetLibraryConfig, getVolcengineTosConfig } from './modelRegistry'

const RELAY_SERVICE = 'ark'
const RELAY_VERSION = '2024-01-01'
const RELAY_REGION = 'cn-beijing'
const RELAY_PROJECT_NAME = 'default'
const RELAY_GROUP_TYPE = 'AIGC'
const DESCRIPTION_LIMIT = 300
const NAME_LIMIT = 64
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 120000
const TOS_UPLOAD_BY_URL_ENDPOINT = '/api/tos/upload-by-url'
const TOS_UPLOAD_FILE_ENDPOINT = '/api/tos/upload-file'
const TOS_DELETE_OBJECT_ENDPOINT = '/api/tos/delete-object'
const TOS_VERIFY_OBJECT_ENDPOINT = '/api/tos/verify-object'
const TOS_ASSET_ID_PREFIX = 'tos:'
const TOS_PATH_PREFIX = 'manju'

export type RelayResourceKind =
  | 'character'
  | 'scene'
  | 'prop'
  | 'shot'
  | 'video'

export type TosResourceKind =
  | 'role'
  | 'scene'
  | 'prop'
  | 'image'
  | 'audio'
  | 'video'
  | 'shot'

type RelayAssetType = 'Image' | 'Video'

type RelayAssetItem = {
  Id?: string
  id?: string
  Name?: string
  name?: string
  URL?: string
  url?: string
  Status?: string
  status?: string
  AssetType?: RelayAssetType
  assetType?: RelayAssetType
  GroupId?: string
  groupId?: string
}

type RelayListAssetsResponse = {
  Items?: RelayAssetItem[]
  TotalCount?: number
  PageNumber?: number
  PageSize?: number
}

type MutableResourceSummary = Record<RelayResourceKind, number>

export interface RelaySyncSummary {
  checked: number
  uploaded: number
  merged: number
  missing: number
  stale: number
  failed: number
  byType: MutableResourceSummary
  warnings: string[]
}

export interface RelayProjectSyncResult {
  skipped: boolean
  reason?: string
  project: SeriesProject
  episodes: Episode[]
  summary: RelaySyncSummary
}

export interface RelayEpisodeSyncResult {
  skipped: boolean
  reason?: string
  project: SeriesProject
  episode: Episode
  summary: RelaySyncSummary
}

export interface RelayUploadResult {
  skipped: boolean
  reason?: string
  groupId?: string
  assetId?: string
  url?: string
  objectKey?: string
  tosStatus?: 'success' | 'skipped' | 'failed'
  relayStatus?: 'success' | 'skipped' | 'failed'
  tosMessage?: string
  relayMessage?: string
}

export type MediaUploadStage =
  | 'start_tos_upload'
  | 'tos_upload_success'
  | 'start_relay_upload'

interface RelayLocalAssetCandidate {
  kind: RelayResourceKind
  localId: string
  episodeId: string
  name: string
  label: string
  url?: string
  currentAssetId?: string
}

const createEmptySummary = (): RelaySyncSummary => ({
  checked: 0,
  uploaded: 0,
  merged: 0,
  missing: 0,
  stale: 0,
  failed: 0,
  byType: {
    character: 0,
    scene: 0,
    prop: 0,
    shot: 0,
    video: 0
  },
  warnings: []
})

const normalizeConfig = (
  rawConfig?: AssetLibraryConfig | null
): AssetLibraryConfig | null => {
  const source = rawConfig || getAssetLibraryConfig()
  if (!source) return null
  const address = String(source.address || '')
    .trim()
    .replace(/\/+$/, '')
  const accessKey = String(source.access_key || '').trim()
  const secretKey = String(source.secret_key || '').trim()
  if (!address || !accessKey || !secretKey) {
    return null
  }
  return {
    ...source,
    address,
    access_key: accessKey,
    secret_key: secretKey
  }
}

export const hasAssetRelayConfig = (): boolean => normalizeConfig() !== null

const normalizeTosConfig = (
  rawConfig?: VolcengineTosConfig | null
): VolcengineTosConfig | null => {
  const source = rawConfig || getVolcengineTosConfig()
  if (!source) return null
  const normalizeHost = (rawHost: string): string => {
    const trimmed = String(rawHost || '')
      .trim()
      .replace(/\/+$/, '')
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }
  const region = String(source.region || '').trim()
  const bucketName = String(source.bucketName || '').trim()
  const host = normalizeHost(source.host || '')
  const accessKeyId = String(source.accessKeyId || '').trim()
  const secretAccessKey = String(source.secretAccessKey || '').trim()
  if (!region || !bucketName || !host || !accessKeyId || !secretAccessKey) {
    return null
  }
  return {
    region,
    bucketName,
    host,
    accessKeyId,
    secretAccessKey
  }
}

export const hasVolcengineTosConfig = (): boolean =>
  normalizeTosConfig() !== null

type TosVerifyResponse = {
  success?: boolean
  message?: string
  statusCode?: number
}

const TOS_VERIFY_OBJECT_KEY = 'ping.txt'

export const verifyVolcengineTosConfigByGetObject = async (
  rawConfig?: VolcengineTosConfig | null
): Promise<{ statusCode?: number; message: string }> => {
  const config = normalizeTosConfig(rawConfig)
  if (!config) {
    throw new Error('对象存储配置不完整')
  }
  const response = await fetch(TOS_VERIFY_OBJECT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      region: config.region,
      bucketName: config.bucketName,
      host: config.host,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      objectKey: TOS_VERIFY_OBJECT_KEY
    })
  })
  const payload = parseJsonResponse(await response.text()) as TosVerifyResponse
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || '对象存储验证失败')
  }
  return {
    statusCode: payload.statusCode,
    message: String(payload.message || '验证通过')
  }
}

const cloneValue = <T>(value: T): T => structuredClone(value)

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const truncate = (value: string, max: number): string =>
  collapseWhitespace(value).slice(0, max)

const isHttpUrl = (value?: string): boolean => /^https?:\/\//i.test(value || '')

const sanitizePathSegment = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/[\\/#?%]/g, '_')

const mapRelayKindToTosType = (kind: RelayResourceKind): TosResourceKind => {
  switch (kind) {
    case 'character':
      return 'role'
    case 'scene':
      return 'scene'
    case 'prop':
      return 'prop'
    case 'shot':
      return 'shot'
    case 'video':
      return 'video'
  }
}

const inferExtensionFromUrl = (
  value: string | undefined,
  fallback: string
): string => {
  const normalizedFallback = fallback.startsWith('.')
    ? fallback
    : `.${fallback}`
  if (!value) return normalizedFallback
  const currentStage: 'tos' | 'relay' = 'tos'
  try {
    const target = new URL(value)
    const pathname = target.pathname || ''
    const suffix = pathname
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    if (!suffix) return normalizedFallback
    return `.${suffix}`
  } catch {
    return normalizedFallback
  }
}

const inferExtensionFromFile = (file: File, fallback: string): string => {
  const fromName = inferExtensionFromUrl(file.name, '')
  if (fromName !== '.') return fromName
  const mime = String(file.type || '').toLowerCase()
  if (mime.includes('png')) return '.png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('mp4')) return '.mp4'
  if (mime.includes('mp3')) return '.mp3'
  return fallback.startsWith('.') ? fallback : `.${fallback}`
}

const buildTosObjectKey = (params: {
  projectId: string
  seriesId: string
  type: TosResourceKind
  resourceId: string
  extension: string
  timestamp?: number
}): string => {
  const safeProjectId = sanitizePathSegment(params.projectId)
  const safeSeriesId = sanitizePathSegment(params.seriesId)
  const safeResourceId = sanitizePathSegment(params.resourceId)
  const timestamp = params.timestamp || Date.now()
  const normalizedExt = params.extension.startsWith('.')
    ? params.extension
    : `.${params.extension}`
  const fileName = `${safeResourceId}-${timestamp}${normalizedExt}`
  const typeSegment =
    params.type === 'image' ||
    params.type === 'video' ||
    params.type === 'audio'
      ? `media/${params.type}`
      : params.type
  return [
    TOS_PATH_PREFIX,
    safeProjectId,
    safeSeriesId,
    typeSegment,
    fileName
  ].join('/')
}

const buildTosPublicUrl = (host: string, objectKey: string): string =>
  `${(/^https?:\/\//i.test(String(host || '').trim()) ? String(host || '').trim() : `https://${String(host || '').trim()}`).replace(/\/+$/, '')}/${String(objectKey || '').replace(/^\/+/, '')}`

const toTosAssetId = (objectKey: string): string =>
  `${TOS_ASSET_ID_PREFIX}${objectKey}`

const parseTosObjectKeyFromAssetId = (assetId?: string): string | null => {
  const normalized = String(assetId || '').trim()
  if (!normalized) return null
  if (normalized.startsWith(TOS_ASSET_ID_PREFIX)) {
    return normalized.slice(TOS_ASSET_ID_PREFIX.length)
  }
  if (normalized.startsWith(`${TOS_PATH_PREFIX}/`)) {
    return normalized
  }
  return null
}

export const resolveTosPublicUrlFromAssetId = (
  assetId?: string
): string | null => {
  const objectKey = parseTosObjectKeyFromAssetId(assetId)
  if (!objectKey) return null
  const config = normalizeTosConfig()
  if (!config?.host) return null
  return buildTosPublicUrl(config.host, objectKey)
}

const toAssetName = (kind: RelayResourceKind, id: string): string => {
  switch (kind) {
    case 'character':
      return `role__${id}`
    case 'scene':
      return `scene__${id}`
    case 'prop':
      return `prop__${id}`
    case 'shot':
      return `shot__${id}`
    case 'video':
      return `video__${id}`
  }
}

const getAssetType = (kind: RelayResourceKind): RelayAssetType =>
  kind === 'video' ? 'Video' : 'Image'

const getAssetItemId = (item: RelayAssetItem): string =>
  String(item.Id || item.id || '').trim()

const getAssetItemName = (item: RelayAssetItem): string =>
  String(item.Name || item.name || '').trim()

const getAssetItemStatus = (item: RelayAssetItem): string =>
  String(item.Status || item.status || '').trim()

const getAssetItemUrl = (item: RelayAssetItem): string =>
  String(item.URL || item.url || '').trim()

const getAssetItemAssetType = (item: RelayAssetItem): RelayAssetType =>
  (item.AssetType || item.assetType || 'Image') as RelayAssetType

const buildProjectDescription = (
  seriesList: Series[],
  episodes: Episode[]
): string => {
  const seriesOrder = new Map(
    seriesList.map((item) => [item.id, item.sortOrder])
  )
  const entries = episodes
    .slice()
    .sort((left, right) => {
      const leftSeries = seriesOrder.get(left.seriesId) ?? 0
      const rightSeries = seriesOrder.get(right.seriesId) ?? 0
      if (leftSeries !== rightSeries) return rightSeries - leftSeries
      if (left.episodeNumber !== right.episodeNumber) {
        return right.episodeNumber - left.episodeNumber
      }
      return (right.lastModified || 0) - (left.lastModified || 0)
    })
    .map((episode) => `${episode.seriesId}__${episode.id}`)

  const selected: string[] = []
  for (const entry of entries) {
    const draft = [entry, ...selected].join('\n')
    if (draft.length > DESCRIPTION_LIMIT) continue
    selected.unshift(entry)
  }

  return selected.join('\n')
}

const pickShotImageUrl = (shot: Shot): string | undefined => {
  if (isHttpUrl(shot.nineGrid?.imageUrl)) return shot.nineGrid?.imageUrl
  const startKeyframe = shot.keyframes?.find((item) => item.type === 'start')
  if (isHttpUrl(startKeyframe?.imageUrl)) return startKeyframe?.imageUrl
  const endKeyframe = shot.keyframes?.find((item) => item.type === 'end')
  if (isHttpUrl(endKeyframe?.imageUrl)) return endKeyframe?.imageUrl
  return undefined
}

const collectEpisodeCandidates = (
  episode: Episode,
  kinds?: RelayResourceKind[]
): RelayLocalAssetCandidate[] => {
  const enabledKinds = new Set<RelayResourceKind>(
    kinds || ['character', 'scene', 'prop', 'shot', 'video']
  )
  const candidates: RelayLocalAssetCandidate[] = []

  if (episode.scriptData) {
    if (enabledKinds.has('character')) {
      for (const character of episode.scriptData.characters || []) {
        candidates.push({
          kind: 'character',
          localId: character.id,
          episodeId: episode.id,
          name: toAssetName('character', character.id),
          label: `角色 ${character.name || character.id}`,
          url: character.referenceImage,
          currentAssetId: character.assetId
        })
      }
    }

    if (enabledKinds.has('scene')) {
      for (const scene of episode.scriptData.scenes || []) {
        candidates.push({
          kind: 'scene',
          localId: scene.id,
          episodeId: episode.id,
          name: toAssetName('scene', scene.id),
          label: `场景 ${scene.location || scene.id}`,
          url: scene.referenceImage,
          currentAssetId: scene.assetId
        })
      }
    }

    if (enabledKinds.has('prop')) {
      for (const prop of episode.scriptData.props || []) {
        candidates.push({
          kind: 'prop',
          localId: prop.id,
          episodeId: episode.id,
          name: toAssetName('prop', prop.id),
          label: `道具 ${prop.name || prop.id}`,
          url: prop.referenceImage,
          currentAssetId: prop.assetId
        })
      }
    }
  }

  for (const shot of episode.shots || []) {
    if (enabledKinds.has('shot')) {
      candidates.push({
        kind: 'shot',
        localId: shot.id,
        episodeId: episode.id,
        name: toAssetName('shot', shot.id),
        label: `分镜 ${shot.id}`,
        url: pickShotImageUrl(shot),
        currentAssetId: shot.assetId
      })
    }

    if (enabledKinds.has('video') && shot.interval) {
      candidates.push({
        kind: 'video',
        localId: shot.interval.id,
        episodeId: episode.id,
        name: toAssetName('video', shot.interval.id),
        label: `视频 ${shot.interval.id}`,
        url: shot.interval.videoUrl,
        currentAssetId: shot.interval.assetId
      })
    }
  }

  return candidates
}

const upsertEpisodeAssetId = (
  episode: Episode,
  kind: RelayResourceKind,
  localId: string,
  assetId: string
): Episode => {
  const nextEpisode = cloneValue(episode)
  if (kind === 'character') {
    const character = nextEpisode.scriptData?.characters.find(
      (item) => item.id === localId
    )
    if (character) character.assetId = assetId
    return nextEpisode
  }

  if (kind === 'scene') {
    const scene = nextEpisode.scriptData?.scenes.find(
      (item) => item.id === localId
    )
    if (scene) scene.assetId = assetId
    return nextEpisode
  }

  if (kind === 'prop') {
    const prop = nextEpisode.scriptData?.props?.find(
      (item) => item.id === localId
    )
    if (prop) prop.assetId = assetId
    return nextEpisode
  }

  if (kind === 'shot') {
    const shot = nextEpisode.shots.find((item) => item.id === localId)
    if (shot) shot.assetId = assetId
    return nextEpisode
  }

  const shot = nextEpisode.shots.find((item) => item.interval?.id === localId)
  if (shot?.interval) shot.interval.assetId = assetId
  return nextEpisode
}

const clearEpisodeAssetId = (
  episode: Episode,
  kind: RelayResourceKind,
  localId: string
): Episode => {
  const nextEpisode = cloneValue(episode)
  if (kind === 'character') {
    const character = nextEpisode.scriptData?.characters.find(
      (item) => item.id === localId
    )
    if (character) delete character.assetId
    return nextEpisode
  }

  if (kind === 'scene') {
    const scene = nextEpisode.scriptData?.scenes.find(
      (item) => item.id === localId
    )
    if (scene) delete scene.assetId
    return nextEpisode
  }

  if (kind === 'prop') {
    const prop = nextEpisode.scriptData?.props?.find(
      (item) => item.id === localId
    )
    if (prop) delete prop.assetId
    return nextEpisode
  }

  if (kind === 'shot') {
    const shot = nextEpisode.shots.find((item) => item.id === localId)
    if (shot) delete shot.assetId
    return nextEpisode
  }

  const shot = nextEpisode.shots.find((item) => item.interval?.id === localId)
  if (shot?.interval) delete shot.interval.assetId
  return nextEpisode
}

const getCandidateLabel = (candidate: RelayLocalAssetCandidate): string =>
  `${candidate.label} (${candidate.name})`

const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const encodeUtf8 = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(new TextEncoder().encode(value))

const sha256Hex = async (value: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', encodeUtf8(value)))

const hmac = async (
  key: ArrayBuffer | Uint8Array<ArrayBuffer>,
  value: string
): Promise<ArrayBuffer> => {
  const rawKey: Uint8Array<ArrayBuffer> =
    key instanceof Uint8Array ? Uint8Array.from(key) : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encodeUtf8(value))
}

const encodeRFC3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )

const toCanonicalPath = (url: URL): string =>
  url.pathname
    .split('/')
    .map((segment) => encodeRFC3986(segment))
    .join('/')

const toCanonicalQuery = (url: URL): string =>
  Array.from(url.searchParams.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) return leftKey.localeCompare(rightKey)
      return leftValue.localeCompare(rightValue)
    })
    .map(([key, value]) => `${encodeRFC3986(key)}=${encodeRFC3986(value)}`)
    .join('&')

const toIsoDate = (date: Date): string =>
  date.toISOString().replace(/[:-]|\.\d{3}/g, '')

const buildSignedHeaders = async (
  config: AssetLibraryConfig,
  url: URL,
  body: string
): Promise<Record<string, string>> => {
  const timestamp = toIsoDate(new Date())
  const shortDate = timestamp.slice(0, 8)
  const payloadHash = await sha256Hex(body)
  const canonicalHeaders = [
    ['content-type', 'application/json'],
    ['host', url.host],
    ['x-content-sha256', payloadHash],
    ['x-date', timestamp]
  ] as const
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(';')
  const canonicalRequest = [
    'POST',
    toCanonicalPath(url) || '/',
    toCanonicalQuery(url),
    canonicalHeaders.map(([key, value]) => `${key}:${value}\n`).join(''),
    signedHeaders,
    payloadHash
  ].join('\n')
  const credentialScope = `${shortDate}/${RELAY_REGION}/${RELAY_SERVICE}/request`
  const stringToSign = [
    'HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n')

  const dateKey = await hmac(encodeUtf8(config.secret_key), shortDate)
  const regionKey = await hmac(dateKey, RELAY_REGION)
  const serviceKey = await hmac(regionKey, RELAY_SERVICE)
  const signingKey = await hmac(serviceKey, 'request')
  const signature = hex(await hmac(signingKey, stringToSign))

  return {
    'Content-Type': 'application/json',
    Host: url.host,
    'X-Date': timestamp,
    'X-Content-Sha256': payloadHash,
    Authorization: `HMAC-SHA256 Credential=${config.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  }
}

const parseJsonResponse = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractErrorMessage = (value: unknown): string => {
  if (!value) return '素材库请求失败'
  if (typeof value === 'string') return value
  if (!isRecordObject(value)) return String(value)

  const message = value.message
  if (typeof message === 'string') return message
  const upperMessage = value.Message
  if (typeof upperMessage === 'string') return upperMessage

  const error = value.error
  if (isRecordObject(error) && typeof error.message === 'string') {
    return error.message
  }

  const upperError = value.Error
  if (isRecordObject(upperError) && typeof upperError.Message === 'string') {
    return upperError.Message
  }

  const responseMetadata = value.ResponseMetadata
  if (isRecordObject(responseMetadata) && isRecordObject(responseMetadata.Error)) {
    const nestedMessage = responseMetadata.Error.Message
    if (typeof nestedMessage === 'string') return nestedMessage
  }

  return JSON.stringify(value)
}

const buildActionUrls = (endpoint: string, action: string): string[] => {
  const base = endpoint.replace(/\/+$/, '')
  return [
    `${base}/?Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(RELAY_VERSION)}`,
    `${base}/open/${encodeURIComponent(action)}`
  ]
}

const callRelay = async <T>(
  action: string,
  payload: Record<string, unknown>,
  options?: {
    config?: AssetLibraryConfig
    requireHttp200?: boolean
  }
): Promise<T> => {
  const config = normalizeConfig(options?.config)
  if (!config) {
    throw new Error('素材库配置缺失')
  }

  const body = JSON.stringify(payload)
  let lastError: unknown = null

  for (const requestUrl of buildActionUrls(config.address, action)) {
    try {
      const url = new URL(requestUrl)
      const headers = await buildSignedHeaders(config, url, body)
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body
      })
      if (options?.requireHttp200 && response.status !== 200) {
        throw new Error(`素材库验证失败：HTTP ${response.status}`)
      }
      const responseText = await response.text()
      const parsed = parseJsonResponse(responseText)
      if (!response.ok) {
        const message = extractErrorMessage(parsed)
        if (response.status === 404 || response.status === 405) {
          lastError = new Error(message)
          continue
        }
        throw new Error(message)
      }

      if (parsed && typeof parsed === 'object' && 'Result' in parsed) {
        return parsed.Result as T
      }
      return parsed as T
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('素材库请求失败')
}

const callTosApi = async <T>(
  endpoint: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch(endpoint, init)
  const payload = parseJsonResponse(await response.text())
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload))
  }
  return payload as T
}

type TosUploadByUrlPayload = {
  sourceUrl: string
  objectKey: string
  region: string
  bucketName: string
  host: string
  accessKeyId: string
  secretAccessKey: string
}

type TosUploadResponse = {
  objectKey?: string
  object_key?: string
  key?: string
  url?: string
}

type TosDeleteObjectPayload = {
  objectKey: string
}

const uploadToTosByUrl = async (
  config: VolcengineTosConfig,
  payload: TosUploadByUrlPayload
): Promise<{ objectKey: string; url: string }> => {
  const response = await callTosApi<TosUploadResponse>(
    TOS_UPLOAD_BY_URL_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        region: config.region,
        bucketName: config.bucketName,
        host: config.host,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      })
    }
  )
  const objectKey = String(
    response.objectKey ||
      response.object_key ||
      response.key ||
      payload.objectKey
  ).trim()
  if (!objectKey) {
    throw new Error('对象存储上传成功但未返回 objectKey')
  }
  const publicUrl =
    String(response.url || '').trim() ||
    buildTosPublicUrl(config.host, objectKey)
  return { objectKey, url: publicUrl }
}

const uploadToTosByFile = async (
  config: VolcengineTosConfig,
  params: { file: File; objectKey: string }
): Promise<{ objectKey: string; url: string }> => {
  const formData = new FormData()
  formData.set('file', params.file)
  formData.set('objectKey', params.objectKey)
  formData.set('region', config.region)
  formData.set('bucketName', config.bucketName)
  formData.set('host', config.host)
  formData.set('accessKeyId', config.accessKeyId)
  formData.set('secretAccessKey', config.secretAccessKey)
  const response = await callTosApi<TosUploadResponse>(
    TOS_UPLOAD_FILE_ENDPOINT,
    {
      method: 'POST',
      body: formData
    }
  )
  const objectKey = String(
    response.objectKey ||
      response.object_key ||
      response.key ||
      params.objectKey
  ).trim()
  if (!objectKey) {
    throw new Error('对象存储上传成功但未返回 objectKey')
  }
  const publicUrl =
    String(response.url || '').trim() ||
    buildTosPublicUrl(config.host, objectKey)
  return { objectKey, url: publicUrl }
}

const uploadGeneratedAssetToTos = async (params: {
  project: SeriesProject
  episode: Episode
  kind: RelayResourceKind
  localId: string
  url?: string
}): Promise<{ assetId: string; objectKey: string; url: string }> => {
  const config = normalizeTosConfig()
  if (!config) {
    throw new Error('对象存储配置不完整')
  }
  if (!isHttpUrl(params.url)) {
    throw new Error('当前资源缺少可上传的公网 URL')
  }

  const objectKey = buildTosObjectKey({
    projectId: params.project.id,
    seriesId: params.episode.seriesId,
    type: mapRelayKindToTosType(params.kind),
    resourceId: params.localId,
    extension: inferExtensionFromUrl(
      params.url,
      params.kind === 'video' ? '.mp4' : '.png'
    )
  })
  const uploaded = await uploadToTosByUrl(config, {
    sourceUrl: params.url!,
    objectKey,
    region: config.region,
    bucketName: config.bucketName,
    host: config.host,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  })
  return {
    assetId: toTosAssetId(uploaded.objectKey),
    objectKey: uploaded.objectKey,
    url: uploaded.url
  }
}

export const uploadAssetFileToTos = async (params: {
  project: SeriesProject
  episode: Episode
  type: TosResourceKind
  resourceId: string
  file: File
}): Promise<{ assetId: string; objectKey: string; url: string }> => {
  const config = normalizeTosConfig()
  if (!config) {
    throw new Error('对象存储配置不完整')
  }
  const objectKey = buildTosObjectKey({
    projectId: params.project.id,
    seriesId: params.episode.seriesId,
    type: params.type,
    resourceId: params.resourceId,
    extension: inferExtensionFromFile(
      params.file,
      params.type === 'video' ? '.mp4' : '.png'
    )
  })
  const uploaded = await uploadToTosByFile(config, {
    file: params.file,
    objectKey
  })
  return {
    assetId: toTosAssetId(uploaded.objectKey),
    objectKey: uploaded.objectKey,
    url: uploaded.url
  }
}

export const uploadMediaAssetFile = async (params: {
  project: SeriesProject
  seriesList: Series[]
  episodes: Episode[]
  episode: Episode
  mediaType: MediaAssetType
  resourceId: string
  file: File
  currentAssetId?: string
  onStage?: (stage: MediaUploadStage) => void
}): Promise<RelayUploadResult> => {
  const toTosType = (type: MediaAssetType): TosResourceKind => {
    if (type === 'video') return 'video'
    if (type === 'audio') return 'audio'
    return 'image'
  }
  const toRelayKind = (type: MediaAssetType): RelayResourceKind =>
    type === 'video' ? 'video' : 'prop'
  const mediaName = `media__${params.mediaType}__${params.resourceId}`
  let currentStage: 'tos' | 'relay' = 'tos'

  try {
    params.onStage?.('start_tos_upload')
    const tosUploaded = await uploadAssetFileToTos({
      project: params.project,
      episode: params.episode,
      type: toTosType(params.mediaType),
      resourceId: params.resourceId,
      file: params.file
    })
    params.onStage?.('tos_upload_success')

    if (params.mediaType === 'audio') {
      return {
        skipped: false,
        assetId: tosUploaded.assetId,
        objectKey: tosUploaded.objectKey,
        url: tosUploaded.url,
        tosStatus: 'success',
        relayStatus: 'skipped',
        tosMessage: '上传资源到对象存储成功',
        relayMessage: '音频资源无需上传素材库，已跳过'
      }
    }

    const config = normalizeConfig()
    if (!config) {
      return {
        skipped: false,
        assetId: tosUploaded.assetId,
        objectKey: tosUploaded.objectKey,
        url: tosUploaded.url,
        tosStatus: 'success',
        relayStatus: 'skipped',
        tosMessage: '上传资源到对象存储成功',
        relayMessage: '素材库未配置，跳过'
      }
    }

    const nextProject = await ensureProjectGroup(
      params.project,
      params.seriesList,
      params.episodes
    )
    const remoteAssets = await listAssetsByGroup(nextProject.assetGroupId!)
    const candidate: RelayLocalAssetCandidate = {
      kind: toRelayKind(params.mediaType),
      localId: params.resourceId,
      episodeId: params.episode.id,
      name: mediaName,
      label: mediaName,
      url: tosUploaded.url,
      currentAssetId: params.currentAssetId
    }
    const duplicate = findRemoteByName(remoteAssets, candidate.name)
    const remoteCurrent = findRemoteById(remoteAssets, params.currentAssetId)

    if (remoteCurrent && getAssetItemId(remoteCurrent)) {
      scheduleTosDelete(getAssetItemId(remoteCurrent), {
        source: 'uploadMediaAssetFile-replace-current',
        mediaType: params.mediaType,
        resourceId: params.resourceId
      })
      await deleteRemoteAsset(getAssetItemId(remoteCurrent))
    }
    if (duplicate && getAssetItemId(duplicate) !== params.currentAssetId) {
      scheduleTosDelete(getAssetItemId(duplicate), {
        source: 'uploadMediaAssetFile-replace-duplicate',
        mediaType: params.mediaType,
        resourceId: params.resourceId
      })
      await deleteRemoteAsset(getAssetItemId(duplicate))
    }

    currentStage = 'relay'
    params.onStage?.('start_relay_upload')
    const assetId = await createRemoteAssetWithPolling(
      nextProject.assetGroupId!,
      candidate
    )
    return {
      skipped: false,
      groupId: nextProject.assetGroupId,
      assetId,
      objectKey: tosUploaded.objectKey,
      url: tosUploaded.url,
      tosStatus: 'success',
      relayStatus: 'success',
      tosMessage: '上传资源到对象存储成功',
      relayMessage: `上传资源到素材库成功：assetId=${assetId}`
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    if (currentStage === 'relay') {
      return {
        skipped: true,
        reason: message,
        tosStatus: 'success',
        relayStatus: 'failed',
        tosMessage: '上传资源到对象存储成功',
        relayMessage: `上传资源到素材库失败：${message}`
      }
    }
    return {
      skipped: true,
      reason: message,
      tosStatus: 'failed',
      relayStatus: 'skipped',
      tosMessage: `上传资源到对象存储失败：${message}`,
      relayMessage: '未执行素材库同步'
    }
  }
}

const deleteTosObject = async (
  config: VolcengineTosConfig,
  payload: TosDeleteObjectPayload
): Promise<void> => {
  await callTosApi<void>(TOS_DELETE_OBJECT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      region: config.region,
      bucketName: config.bucketName,
      host: config.host,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    })
  })
}

const scheduleTosDelete = (
  assetId?: string,
  context?: Record<string, unknown>
): void => {
  const objectKey = parseTosObjectKeyFromAssetId(assetId)
  if (!objectKey) return
  const config = normalizeTosConfig()
  if (!config) return
  void deleteTosObject(config, { objectKey })
    .then(() => {
      console.info('[tos-delete] success', {
        action: 'delete_object',
        objectKey,
        context: context || {}
      })
    })
    .catch((error) => {
      console.error('[tos-delete] failed', {
        action: 'delete_object',
        objectKey,
        context: context || {},
        error: error instanceof Error ? error.message : String(error)
      })
    })
}

export const verifyRelayConfigByListAssetGroups = async (
  config: AssetLibraryConfig
): Promise<void> => {
  await callRelay(
    'ListAssetGroups',
    {
      Filter: {
        name: '',
        GroupIds: [],
        GroupType: RELAY_GROUP_TYPE
      }
    },
    {
      config,
      requireHttp200: true
    }
  )
}

const ensureProjectGroup = async (
  project: SeriesProject,
  seriesList: Series[],
  episodes: Episode[]
): Promise<SeriesProject> => {
  const description = buildProjectDescription(seriesList, episodes)
  const safeName =
    truncate(project.title || project.id, NAME_LIMIT) || project.id
  const nextProject = { ...project }

  if (!nextProject.assetGroupId) {
    const result = await callRelay<{ Id?: string; id?: string }>(
      'CreateAssetGroup',
      {
        Name: safeName,
        Description: description,
        GroupType: RELAY_GROUP_TYPE,
        ProjectName: RELAY_PROJECT_NAME
      }
    )
    nextProject.assetGroupId = String(result.Id || result.id || '').trim()
    if (!nextProject.assetGroupId) {
      throw new Error('CreateAssetGroup 未返回 GroupId')
    }
    return nextProject
  }

  await callRelay('UpdateAssetGroup', {
    Id: nextProject.assetGroupId,
    Name: safeName,
    Description: description,
    ProjectName: RELAY_PROJECT_NAME
  })
  return nextProject
}

const listAssetsByGroup = async (
  groupId: string
): Promise<RelayAssetItem[]> => {
  const items: RelayAssetItem[] = []
  let pageNumber = 1
  let totalCount = Number.MAX_SAFE_INTEGER

  while (items.length < totalCount) {
    const response = await callRelay<RelayListAssetsResponse>('ListAssets', {
      Filter: {
        GroupIds: [groupId],
        GroupType: RELAY_GROUP_TYPE,
        Statuses: ['Active', 'Processing', 'Failed']
      },
      PageNumber: pageNumber,
      PageSize: 100,
      ProjectName: RELAY_PROJECT_NAME
    })
    const pageItems = response.Items || []
    items.push(...pageItems)
    totalCount = Number(response.TotalCount || pageItems.length || 0)
    if (pageItems.length === 0 || pageItems.length < 100) break
    pageNumber += 1
  }

  return items
}

const createRemoteAsset = async (
  groupId: string,
  candidate: RelayLocalAssetCandidate
): Promise<string> => {
  const response = await callRelay<{ Id?: string; id?: string }>(
    'CreateAsset',
    {
      GroupId: groupId,
      URL: candidate.url,
      Name: truncate(candidate.name, NAME_LIMIT),
      AssetType: getAssetType(candidate.kind),
      ProjectName: RELAY_PROJECT_NAME
    }
  )
  const assetId = String(response.Id || response.id || '').trim()
  if (!assetId) {
    throw new Error(`CreateAsset 未返回 AssetId: ${candidate.name}`)
  }
  return assetId
}

const getRemoteAsset = async (assetId: string): Promise<RelayAssetItem> =>
  callRelay<RelayAssetItem>('GetAsset', {
    Id: assetId,
    ProjectName: RELAY_PROJECT_NAME
  })

const waitForAssetActive = async (assetId: string): Promise<RelayAssetItem> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const item = await getRemoteAsset(assetId)
    const status = getAssetItemStatus(item)
    if (status === 'Active') return item
    if (status === 'Failed') {
      throw new Error(`素材处理失败: ${assetId}`)
    }
    await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error(`素材处理超时: ${assetId}`)
}

export const deleteRemoteAsset = async (assetId?: string): Promise<void> => {
  if (!assetId) return
  const tosObjectKey = parseTosObjectKeyFromAssetId(assetId)
  if (tosObjectKey) {
    scheduleTosDelete(assetId, { source: 'deleteRemoteAsset' })
    return
  }
  if (!hasAssetRelayConfig()) return
  void callRelay('DeleteAsset', {
    Id: assetId,
    ProjectName: RELAY_PROJECT_NAME
  }).catch((error) => {
    console.error('[relay-delete] failed', {
      action: 'DeleteAsset',
      assetId,
      error: extractErrorMessage(error)
    })
  })
}

const createRemoteAssetWithPolling = async (
  groupId: string,
  candidate: RelayLocalAssetCandidate
): Promise<string> => {
  const assetId = await createRemoteAsset(groupId, candidate)
  await waitForAssetActive(assetId)
  return assetId
}

const shouldUploadCandidate = (candidate: RelayLocalAssetCandidate): boolean =>
  isHttpUrl(candidate.url)

const findRemoteByName = (
  remoteAssets: RelayAssetItem[],
  name: string
): RelayAssetItem | undefined =>
  remoteAssets.find((item) => getAssetItemName(item) === name)

const findRemoteById = (
  remoteAssets: RelayAssetItem[],
  assetId?: string
): RelayAssetItem | undefined =>
  assetId
    ? remoteAssets.find((item) => getAssetItemId(item) === assetId)
    : undefined

const updateCandidateAssetIdInEpisodes = (
  episodes: Episode[],
  candidate: RelayLocalAssetCandidate,
  assetId: string
): Episode[] =>
  episodes.map((episode) =>
    episode.id === candidate.episodeId
      ? upsertEpisodeAssetId(
          episode,
          candidate.kind,
          candidate.localId,
          assetId
        )
      : episode
  )

export const syncProjectAssetsToRelay = async (params: {
  project: SeriesProject
  seriesList: Series[]
  episodes: Episode[]
}): Promise<RelayProjectSyncResult> => {
  const config = normalizeConfig()
  const summary = createEmptySummary()
  if (!config) {
    return {
      skipped: true,
      reason: '素材库未配置 AK/SK',
      project: params.project,
      episodes: params.episodes,
      summary
    }
  }

  const nextProject = await ensureProjectGroup(
    params.project,
    params.seriesList,
    params.episodes
  )
  let nextEpisodes = params.episodes.map((item) => cloneValue(item))
  const remoteAssets = await listAssetsByGroup(nextProject.assetGroupId!)

  for (const episode of nextEpisodes) {
    const candidates = collectEpisodeCandidates(episode)
    for (const candidate of candidates) {
      summary.checked += 1
      summary.byType[candidate.kind] += 1
      const remoteByName = findRemoteByName(remoteAssets, candidate.name)
      const remoteById = findRemoteById(remoteAssets, candidate.currentAssetId)

      if (remoteByName?.Id || remoteByName?.id) {
        const remoteAssetId = getAssetItemId(remoteByName)
        if (candidate.currentAssetId !== remoteAssetId) {
          nextEpisodes = updateCandidateAssetIdInEpisodes(
            nextEpisodes,
            candidate,
            remoteAssetId
          )
          summary.merged += 1
        }
        continue
      }

      if (remoteById) {
        continue
      }

      if (!shouldUploadCandidate(candidate)) {
        summary.missing += 1
        summary.warnings.push(
          `${getCandidateLabel(candidate)} 缺少可上传的公网 URL，暂未同步到素材库`
        )
        continue
      }

      try {
        const createdAssetId = await createRemoteAssetWithPolling(
          nextProject.assetGroupId!,
          candidate
        )
        remoteAssets.push({
          Id: createdAssetId,
          Name: candidate.name,
          URL: candidate.url,
          Status: 'Active',
          AssetType: getAssetType(candidate.kind)
        })
        nextEpisodes = updateCandidateAssetIdInEpisodes(
          nextEpisodes,
          candidate,
          createdAssetId
        )
        summary.uploaded += 1
      } catch (error) {
        summary.failed += 1
        summary.warnings.push(
          `${getCandidateLabel(candidate)} 上传失败：${extractErrorMessage(error)}`
        )
      }
    }
  }

  return {
    skipped: false,
    project: nextProject,
    episodes: nextEpisodes,
    summary
  }
}

export const reconcileEpisodeAssetsFromRelay = async (params: {
  project: SeriesProject
  seriesList: Series[]
  episodes: Episode[]
  episode: Episode
  kinds: RelayResourceKind[]
}): Promise<RelayEpisodeSyncResult> => {
  const config = normalizeConfig()
  const summary = createEmptySummary()
  if (!config) {
    return {
      skipped: true,
      reason: '素材库未配置 AK/SK',
      project: params.project,
      episode: params.episode,
      summary
    }
  }

  const nextProject = await ensureProjectGroup(
    params.project,
    params.seriesList,
    params.episodes
  )
  let nextEpisode = cloneValue(params.episode)
  const remoteAssets = await listAssetsByGroup(nextProject.assetGroupId!)
  const candidates = collectEpisodeCandidates(nextEpisode, params.kinds)

  for (const candidate of candidates) {
    summary.checked += 1
    summary.byType[candidate.kind] += 1
    const remoteByName = findRemoteByName(remoteAssets, candidate.name)
    const remoteById = findRemoteById(remoteAssets, candidate.currentAssetId)

    if (remoteByName) {
      const remoteAssetId = getAssetItemId(remoteByName)
      if (remoteAssetId && candidate.currentAssetId !== remoteAssetId) {
        nextEpisode = upsertEpisodeAssetId(
          nextEpisode,
          candidate.kind,
          candidate.localId,
          remoteAssetId
        )
        summary.merged += 1
      }
      continue
    }

    if (candidate.currentAssetId && !remoteById) {
      summary.stale += 1
      summary.warnings.push(
        `${getCandidateLabel(candidate)} 绑定的素材 ID 在远端不存在，请重新同步`
      )
      continue
    }

    if (!candidate.currentAssetId) {
      summary.missing += 1
      summary.warnings.push(`${getCandidateLabel(candidate)} 尚未同步到素材库`)
    }
  }

  return {
    skipped: false,
    project: nextProject,
    episode: nextEpisode,
    summary
  }
}

export const uploadGeneratedAssetToRelay = async (params: {
  project: SeriesProject
  seriesList: Series[]
  episodes: Episode[]
  episode: Episode
  kind: RelayResourceKind
  localId: string
  url?: string
  currentAssetId?: string
  skipTosUploadWhenUrlAvailable?: boolean
  onStage?: (
    stage: 'start_tos_upload' | 'tos_upload_success' | 'start_relay_upload'
  ) => void
}): Promise<RelayUploadResult> => {
  const logUploadFlow = (payload: {
    result: 'success' | 'skipped' | 'failed'
    reason?: string
    finalUrl?: string
    finalAssetId?: string
    groupId?: string
    objectKey?: string
    tosUploaded: boolean
    relayUploaded: boolean
  }) => {
    console.info('[asset-upload-flow]', {
      operator: 'frontend-user',
      action: 'upload_generated_asset',
      kind: params.kind,
      localId: params.localId,
      hasTosConfig: !!tosConfig,
      hasRelayConfig: !!config,
      ...payload
    })
  }

  const tosConfig = normalizeTosConfig()
  const config = normalizeConfig()
  if (!tosConfig) {
    logUploadFlow({
      result: 'skipped',
      reason: '对象存储未配置，无法继续同步',
      tosUploaded: false,
      relayUploaded: false
    })
    return {
      skipped: true,
      reason: '对象存储未配置，无法继续同步',
      tosStatus: 'skipped',
      relayStatus: 'skipped',
      tosMessage: '对象存储未配置，无法上传（请先完成对象存储配置）',
      relayMessage: '未执行素材库同步：对象存储上传是前置步骤'
    }
  }

  let finalUrl = params.url
  let tosUploaded:
    | { assetId: string; objectKey: string; url: string }
    | undefined
  const reuseExistingTosUrl =
    params.skipTosUploadWhenUrlAvailable === true && isHttpUrl(params.url)

  if (!reuseExistingTosUrl) {
    try {
      params.onStage?.('start_tos_upload')
      tosUploaded = await uploadGeneratedAssetToTos({
        project: params.project,
        episode: params.episode,
        kind: params.kind,
        localId: params.localId,
        url: params.url
      })
      params.onStage?.('tos_upload_success')
      finalUrl = tosUploaded.url
      scheduleTosDelete(params.currentAssetId, {
        source: 'uploadGeneratedAssetToRelay',
        kind: params.kind,
        localId: params.localId
      })
    } catch (error) {
      logUploadFlow({
        result: 'failed',
        reason: `对象存储上传失败：${extractErrorMessage(error)}`,
        tosUploaded: false,
        relayUploaded: false
      })
      return {
        skipped: true,
        reason: `对象存储上传失败：${extractErrorMessage(error)}`,
        tosStatus: 'failed',
        relayStatus: 'skipped',
        tosMessage: `上传资源到对象存储失败：${extractErrorMessage(error)}`,
        relayMessage: config
          ? '对象存储失败，未执行素材库同步'
          : '素材库未配置，跳过'
      }
    }
  }

  if (!config) {
    logUploadFlow({
      result: 'success',
      finalUrl,
      finalAssetId: tosUploaded?.assetId,
      groupId: params.project.assetGroupId,
      objectKey: tosUploaded?.objectKey,
      tosUploaded: !!tosUploaded,
      relayUploaded: false
    })
    return {
      skipped: false,
      groupId: params.project.assetGroupId,
      assetId: tosUploaded?.assetId,
      objectKey: tosUploaded?.objectKey,
      url: finalUrl,
      tosStatus: reuseExistingTosUrl ? 'skipped' : 'success',
      relayStatus: 'skipped',
      tosMessage: reuseExistingTosUrl
        ? '对象存储已完成，跳过'
        : '上传资源到对象存储成功',
      relayMessage: '素材库未配置，跳过'
    }
  }
  if (
    !shouldUploadCandidate({
      kind: params.kind,
      localId: params.localId,
      episodeId: params.episode.id,
      name: toAssetName(params.kind, params.localId),
      label: params.localId,
      url: finalUrl
    })
  ) {
    logUploadFlow({
      result: 'skipped',
      reason: '当前资源缺少可上传的公网 URL',
      finalUrl,
      tosUploaded: !!tosUploaded,
      relayUploaded: false
    })
    return {
      skipped: true,
      reason: '当前资源缺少可上传的公网 URL',
      objectKey: tosUploaded?.objectKey,
      url: finalUrl,
      tosStatus: reuseExistingTosUrl ? 'skipped' : 'success',
      relayStatus: 'skipped',
      tosMessage: reuseExistingTosUrl
        ? '对象存储已完成，跳过'
        : '上传资源到对象存储成功',
      relayMessage: '素材库同步跳过：当前资源缺少可上传的公网 URL'
    }
  }
  try {
    const nextProject = await ensureProjectGroup(
      params.project,
      params.seriesList,
      params.episodes
    )
    const remoteAssets = await listAssetsByGroup(nextProject.assetGroupId!)
    const candidate: RelayLocalAssetCandidate = {
      kind: params.kind,
      localId: params.localId,
      episodeId: params.episode.id,
      name: toAssetName(params.kind, params.localId),
      label: params.localId,
      url: finalUrl,
      currentAssetId: params.currentAssetId
    }
    const duplicate = findRemoteByName(remoteAssets, candidate.name)
    const remoteCurrent = findRemoteById(remoteAssets, params.currentAssetId)

    if (remoteCurrent && getAssetItemId(remoteCurrent)) {
      scheduleTosDelete(getAssetItemId(remoteCurrent), {
        source: 'relay-upload-replace-current',
        kind: params.kind,
        localId: params.localId
      })
      await deleteRemoteAsset(getAssetItemId(remoteCurrent))
    }
    if (duplicate && getAssetItemId(duplicate) !== params.currentAssetId) {
      scheduleTosDelete(getAssetItemId(duplicate), {
        source: 'relay-upload-replace-duplicate',
        kind: params.kind,
        localId: params.localId
      })
      await deleteRemoteAsset(getAssetItemId(duplicate))
    }

    params.onStage?.('start_relay_upload')
    const assetId = await createRemoteAssetWithPolling(
      nextProject.assetGroupId!,
      candidate
    )
    const result: RelayUploadResult = {
      skipped: false,
      groupId: nextProject.assetGroupId,
      assetId,
      objectKey: tosUploaded?.objectKey,
      url: finalUrl,
      tosStatus: reuseExistingTosUrl ? 'skipped' : 'success',
      relayStatus: 'success',
      tosMessage: reuseExistingTosUrl
        ? '对象存储已完成，跳过'
        : '上传资源到对象存储成功',
      relayMessage: `上传资源到素材库成功：assetId=${assetId}`
    }
    logUploadFlow({
      result: 'success',
      finalUrl,
      finalAssetId: assetId,
      groupId: nextProject.assetGroupId,
      objectKey: tosUploaded?.objectKey,
      tosUploaded: !!tosUploaded,
      relayUploaded: true
    })
    return result
  } catch (error) {
    logUploadFlow({
      result: 'failed',
      reason: `素材库上传失败：${extractErrorMessage(error)}`,
      finalUrl,
      objectKey: tosUploaded?.objectKey,
      tosUploaded: !!tosUploaded,
      relayUploaded: false
    })
    return {
      skipped: true,
      reason: `素材库上传失败：${extractErrorMessage(error)}`,
      objectKey: tosUploaded?.objectKey,
      url: finalUrl,
      tosStatus: reuseExistingTosUrl ? 'skipped' : 'success',
      relayStatus: 'failed',
      tosMessage: reuseExistingTosUrl
        ? '对象存储已完成，跳过'
        : '上传资源到对象存储成功',
      relayMessage: `上传资源到素材库失败：${extractErrorMessage(error)}（请手动同步）`
    }
  }
}

export const syncProjectGroupMetadataToRelay = async (params: {
  project: SeriesProject
  seriesList: Series[]
  episodes: Episode[]
}): Promise<{ skipped: boolean; reason?: string }> => {
  const config = normalizeConfig()
  if (!config) {
    return { skipped: true, reason: '素材库未配置 AK/SK' }
  }
  if (!params.project.assetGroupId) {
    return { skipped: true, reason: '当前项目还没有素材组' }
  }
  await ensureProjectGroup(params.project, params.seriesList, params.episodes)
  return { skipped: false }
}

export const clearEpisodeAssetBinding = (
  episode: Episode,
  kind: RelayResourceKind,
  localId: string
): Episode => clearEpisodeAssetId(episode, kind, localId)
