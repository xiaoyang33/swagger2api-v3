/**
 * AuthController API 接口
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */

import { request } from '../../utils/request';
import type { LoginDto, LoginRespDto } from '../types';
/**
 * 登录
 *
 * @param body
 */
export const authControllerLogin = (data: LoginDto, config?: any) => {
  return request.post<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    ...config
  });
};
