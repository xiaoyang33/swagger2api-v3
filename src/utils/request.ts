import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig
} from 'axios';
export interface IReqBoay<T> {
  code: number;
  data: T;
  message: string;
}

class HttpRequest {
  // 创建axios实例
  private instance: AxiosInstance;
  constructor(options: CreateAxiosDefaults) {
    this.instance = axios.create(options);
    this.instance.interceptors.request.use(this.requestInterceptors);
    this.instance.interceptors.response.use(this.responseInterceptors);
  }
  requestInterceptors(config: InternalAxiosRequestConfig) {
    return config;
  }
  responseInterceptors(response: AxiosResponse) {
    return response.data;
  }

  private request<T>(config: AxiosRequestConfig): Promise<IReqBoay<T>> {
    return new Promise((resolve, reject) => {
      this.instance
        .request<any, IReqBoay<T>>(config)
        .then((res) => {
          console.log('request:', res);
          resolve(res);
        })
        .catch((err) => {
          reject(err.message);
        });
    });
  }
  get<T = any>({ ...config }: AxiosRequestConfig) {
    return this.request<T>({
      ...config,
      method: 'GET'
    });
  }
  post<T = any>({ ...config }: AxiosRequestConfig) {
    return this.request<T>({
      ...config,
      method: 'POST'
    });
  }
}

export const request = new HttpRequest({
  baseURL: ``,
  timeout: 20000
});
