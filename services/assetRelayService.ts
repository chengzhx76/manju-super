import { Episode, Series, SeriesProject, Shot } from '../types'
import type { AssetLibraryConfig } from '../types/model'
import { getAssetLibraryConfig } from './modelRegistry'

const RELAY_SERVICE = 'ark'
const RELAY_VERSION = '2024-01-01'
const RELAY_REGION = 'cn-beijing'
const RELAY_PROJECT_NAME = 'default'
const RELAY_GROUP_TYPE = 'AIGC'
const DESCRIPTION_LIMIT = 300
const NAME_LIMIT = 64
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 120000

export type RelayResourceKind =
  | 'character'
  | 'scene'
  | 'prop'
  | 'shot'
  | 'video'

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
}

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
  const address = String(source.address || '').trim().replace(/\/+$/, '')
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

const cloneValue = <T>(value: T): T => structuredClone(value)

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const truncate = (value: string, max: number): string =>
  collapseWhitespace(value).slice(0, max)

const isHttpUrl = (value?: string): boolean => /^https?:\/\//i.test(value || '')

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

const encodeUtf8 = (value: string): Uint8Array =>
  new TextEncoder().encode(value)

const sha256Hex = async (value: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', encodeUtf8(value)))

const hmac = async (
  key: ArrayBuffer | Uint8Array,
  value: string
): Promise<ArrayBuffer> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? key : new Uint8Array(key),
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

const parseJsonResponse = (raw: string): any => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const extractErrorMessage = (value: any): string => {
  if (!value) return '素材库请求失败'
  if (typeof value === 'string') return value
  if (typeof value?.message === 'string') return value.message
  if (typeof value?.Message === 'string') return value.Message
  if (typeof value?.error?.message === 'string') return value.error.message
  if (typeof value?.Error?.Message === 'string') return value.Error.Message
  if (typeof value?.ResponseMetadata?.Error?.Message === 'string') {
    return value.ResponseMetadata.Error.Message
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
  if (!assetId || !hasAssetRelayConfig()) return
  await callRelay('DeleteAsset', {
    Id: assetId,
    ProjectName: RELAY_PROJECT_NAME
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

  let nextProject = await ensureProjectGroup(
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
}): Promise<RelayUploadResult> => {
  const config = normalizeConfig()
  if (!config) {
    return { skipped: true, reason: '素材库未配置 AK/SK' }
  }
  if (
    !shouldUploadCandidate({
      kind: params.kind,
      localId: params.localId,
      episodeId: params.episode.id,
      name: toAssetName(params.kind, params.localId),
      label: params.localId,
      url: params.url
    })
  ) {
    return { skipped: true, reason: '当前资源缺少可上传的公网 URL' }
  }

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
    url: params.url,
    currentAssetId: params.currentAssetId
  }
  const duplicate = findRemoteByName(remoteAssets, candidate.name)
  const remoteCurrent = findRemoteById(remoteAssets, params.currentAssetId)

  if (remoteCurrent && getAssetItemId(remoteCurrent)) {
    await deleteRemoteAsset(getAssetItemId(remoteCurrent))
  }
  if (duplicate && getAssetItemId(duplicate) !== params.currentAssetId) {
    await deleteRemoteAsset(getAssetItemId(duplicate))
  }

  const assetId = await createRemoteAssetWithPolling(
    nextProject.assetGroupId!,
    candidate
  )
  return {
    skipped: false,
    groupId: nextProject.assetGroupId,
    assetId
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
