/**
 * 导入 / 导出 / 逆向拆分时可选的「清单与图集」目标格式（业界常见第三方为主）。
 * 内部编辑态统一为矩形精灵列表；对外通过适配器读写到下列格式（逐步实现）。
 */
export type AtlasIoFormatId =
  | 'app-v1'
  | 'texturepacker-hash'
  | 'texturepacker-array'
  | 'libgdx'
  | 'cocos2d-plist'
  | 'pixi-multi'

export interface AtlasIoFormatDef {
  id: AtlasIoFormatId
  /** 是否已在本应用中实现读/写 */
  implemented: boolean
  /** 选择描述文件时 input[accept] */
  manifestAccept: string
  i18nTitle: string
  i18nDesc: string
}

/** 导入图集 / 逆向拆分：可选来源格式（与导出 JSON 目标列表一致，便于用户对照） */
export const ATLAS_IO_FORMATS: AtlasIoFormatDef[] = [
  {
    id: 'app-v1',
    implemented: true,
    manifestAccept: '.json,application/json',
    i18nTitle: 'formatsIo.appV1.title',
    i18nDesc: 'formatsIo.appV1.desc',
  },
  {
    id: 'texturepacker-hash',
    implemented: false,
    manifestAccept: '.json,application/json',
    i18nTitle: 'formatsIo.tpHash.title',
    i18nDesc: 'formatsIo.tpHash.desc',
  },
  {
    id: 'texturepacker-array',
    implemented: false,
    manifestAccept: '.json,application/json',
    i18nTitle: 'formatsIo.tpArray.title',
    i18nDesc: 'formatsIo.tpArray.desc',
  },
  {
    id: 'libgdx',
    implemented: false,
    manifestAccept: '.atlas,.txt,text/plain',
    i18nTitle: 'formatsIo.libgdx.title',
    i18nDesc: 'formatsIo.libgdx.desc',
  },
  {
    id: 'cocos2d-plist',
    implemented: false,
    manifestAccept: '.plist,application/xml,text/xml',
    i18nTitle: 'formatsIo.cocos2d.title',
    i18nDesc: 'formatsIo.cocos2d.desc',
  },
  {
    id: 'pixi-multi',
    implemented: false,
    manifestAccept: '.json,application/json',
    i18nTitle: 'formatsIo.pixi.title',
    i18nDesc: 'formatsIo.pixi.desc',
  },
]

export function getFormatDef(id: AtlasIoFormatId): AtlasIoFormatDef | undefined {
  return ATLAS_IO_FORMATS.find((f) => f.id === id)
}
