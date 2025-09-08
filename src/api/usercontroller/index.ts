/**
 * UserController API 接口
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */

import { request } from '../../utils/request';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserListDto,
  UserListRespDto
} from '../types';
/**
 * 用户列表
 *
 * @param body
 */
export const userControllerList = (data: UserListDto, config?: any) => {
  return request.post<UserListRespDto>({
    url: '/admin/system/user/list',
    data,
    ...config
  });
};

/**
 * 创建用户
 *
 * @param body
 */
export const userControllerCreate = (data: CreateUserDto, config?: any) => {
  return request.post<any>({
    url: '/admin/system/user/create',
    data,
    ...config
  });
};

/**
 * 更新用户
 *
 * @param body
 */
export const userControllerUpdate = (data: UpdateUserDto, config?: any) => {
  return request.post<any>({
    url: '/admin/system/user/update',
    data,
    ...config
  });
};

/**
 *
 * @param pageNum 页码
 * @param pageSize 每页数量
 * @param username 用户名
 */
export const userControllerDetail = (
  params: { pageNum?: number; pageSize?: number; username: string },
  config?: any
) => {
  return request.get<any>({
    url: '/admin/system/user/detail',
    params,
    ...config
  });
};

/**
 *
 * @param id
 */
export const userControllerDetail1 = (params: { id: string }, config?: any) => {
  return request.get<any>({
    url: '/admin/system/user/detail1',
    params,
    ...config
  });
};
