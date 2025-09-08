/**
 * MenuController API 接口
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */

import { request } from '../../utils/request';
import type { MenuListRespDto } from '../types';
/**
 * 菜单列表
 */
export const menuControllerList = (config?: any) => {
  return request.post<MenuListRespDto>({
    url: '/admin/system/menus/list',
    ...config
  });
};
