/**
 * API 类型定义
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */
export interface LoginDto {
  /** 账号 */
  account: string;
  /** 密码 */
  password: string;
}

export interface UserInfoRespDto {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
  /** 角色 */
  roles: string[];
}

export interface LoginRespDto {
  /** 用户信息 */
  user: any;
  /** token */
  token: string;
}

export interface UserListDto {
  /** 页码 */
  pageNum?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 用户名 */
  username: string;
}

export interface UserListRespDto {
  /** 列表 */
  list: UserInfoRespDto[];
  /** 总条数 */
  total: number;
}

export interface CreateUserDto {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;

  role: {
    id?: string;
  };
}

export interface UpdateUserDto {
  /** 用户名 */
  username: string;
}

export interface MenuInfoRespDto {
  /** 菜单ID */
  id: string;
  /** 菜单名称 */
  name: string;
  /** 角色 */
  roles: string[];
}

export interface MenuListRespDto {
  /** 列表 */
  list: MenuInfoRespDto[];
  /** 总条数 */
  total: number;
}
