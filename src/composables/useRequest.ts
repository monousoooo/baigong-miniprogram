import { ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { until } from "@/shared";

interface Response<T = unknown> {
  code: string;
  msg: string;
  data: T;
}

const baseURL = import.meta.env.VITE_BASE_URL;

const httpInterceptor = {
  invoke(options: UniApp.RequestOptions) {
    if (!options.url.startsWith("http")) {
      options.url = baseURL + options.url;
    }
    options.timeout = 10000;
    options.header = {
      ...options.header,
      "source-client": "miniprogram",
    };
    //TODO:此处可以获取自己的token
    const token = "";
    if (token) {
      options.header.Authorization = token;
    }
    console.log(options);
  },
};
uni.addInterceptor("request", httpInterceptor);
uni.addInterceptor("uploadFile", httpInterceptor);

type Diff<T extends keyof any, U extends keyof any> = ({ [P in T]: P } & {
  [P in U]: never;
} & { [x: string]: never })[T];
type Overwrite<T, U> = Pick<T, Diff<keyof T, keyof U>> & U;

type RequestConfig = Partial<UniApp.RequestOptions>;
interface RequestResponse<T>
  extends Overwrite<UniApp.RequestSuccessCallbackResult, { data: T }> {}

type RequestInstance = typeof uni.request;

interface UseRequestReturn<T, R = RequestResponse<T>, _D = any> {
  response: ShallowRef<R | undefined>;
  data: Ref<T | undefined>;
  isFinished: Ref<boolean>;
  isLoading: Ref<boolean>;
  isAborted: Ref<boolean>;
  error: ShallowRef<unknown | undefined>;
  abort: (message?: string | undefined) => void;
  cancel: (message?: string | undefined) => void;
  isCanceled: Ref<boolean>;
}

interface StrictUseRequestReturn<T, R, D> extends UseRequestReturn<T, R, D> {
  execute: (
    url?: string | RequestConfig,
    config?: RequestConfig
  ) => Promise<StrictUseRequestReturn<T, R, D>>;
}

interface EasyUseRequestReturn<T, R, D> extends UseRequestReturn<T, R, D> {
  execute: (
    url: string,
    config?: RequestConfig
  ) => Promise<EasyUseRequestReturn<T, R, D>>;
}

interface UseRequestOptions<T = any> {
  /**
   * 使用useRequest时会自动运行request请求
   */
  immediate?: boolean;
  /**
   * 使用shallowRef
   *
   * @default true
   */
  shallow?: boolean;

  /**
   * 捕捉错误的回调
   */
  onError?: (e: unknown) => void;

  /**
   * 捕捉成功的回调
   */
  onSuccess?: (data: T) => void;

  /**
   * 要使用的初始数据
   */
  initialData?: T;

  resetOnExecute?: boolean;

  /**
   * 捕捉结束的回调
   */
  onFinish?: () => void;
}

type OverallUseRequestReturn<T, R, D> =
  | StrictUseRequestReturn<T, R, D>
  | EasyUseRequestReturn<T, R, D>;

export function useRequest<T = any, R = RequestResponse<T>, D = any>(
  url: string,
  config?: RequestConfig,
  options?: UseRequestOptions
): StrictUseRequestReturn<T, R, D> & Promise<StrictUseRequestReturn<T, R, D>>;

export function useRequest<T = any, R = RequestResponse<T>, D = any>(
  config?: RequestConfig
): EasyUseRequestReturn<T, R, D> & Promise<EasyUseRequestReturn<T, R, D>>;

export function useRequest<T = any, R = RequestResponse<T>, D = any>(
  ...args: any[]
): OverallUseRequestReturn<T, R, D> &
  Promise<OverallUseRequestReturn<T, R, D>> {
  const url: string | undefined =
    typeof args[0] === "string" ? args[0] : undefined;
  const argsPlaceholder = typeof url === "string" ? 1 : 0;

  let defaultConfig: RequestConfig = {};

  let instance: RequestInstance = uni.request;
  let options: UseRequestOptions<T> = {
    immediate: !!argsPlaceholder,
    shallow: true,
  };

  if (args.length > 0 + argsPlaceholder) {
    defaultConfig = args[0 + argsPlaceholder];
  }

  if (
    args.length === 2 + argsPlaceholder ||
    args.length === 3 + argsPlaceholder
  ) {
    options = args[args.length - 1];
  }

  const { initialData, shallow, immediate, resetOnExecute = false } = options;

  const response = shallowRef<UniApp.RequestSuccessCallbackResult>();
  const data = (shallow ? shallowRef : ref)<T>(initialData!) as Ref<T>;
  const isFinished = ref(false);
  const isLoading = ref(false);
  const error = shallowRef<unknown>();

  const loading = (loading: boolean) => {
    isLoading.value = loading;
    isFinished.value = !loading;
  };

  const resetData = () => {
    if (resetOnExecute) data.value = initialData!;
  };

  const waitUntilFinished = () =>
    new Promise<OverallUseRequestReturn<T, R, D>>((resolve, reject) => {
      until(isFinished)
        .toBe(true)
        // eslint-disable-next-line ts/no-use-before-define
        .then(() => (error.value ? reject(error.value) : resolve(result)));
    });

  const promise = {
    then: (...args) => waitUntilFinished().then(...args),
    catch: (...args) => waitUntilFinished().catch(...args),
  } as Promise<OverallUseRequestReturn<T, R, D>>;

  let executeCounter = 0;

  const execute: OverallUseRequestReturn<T, R, D>["execute"] = (
    executeUrl: string | RequestConfig | undefined = url,
    config: RequestConfig = {}
  ) => {
    error.value = undefined;
    const _url =
      typeof executeUrl === "string" ? executeUrl : url ?? config.url;
    if (_url === undefined) {
      error.value = "ERR_INVALID_URL";
      isFinished.value = true;
      return promise;
    }

    resetData();

    loading(true);

    executeCounter += 1;
    const currentExecuteCounter = executeCounter;

    instance({ url: _url!!, ...defaultConfig })
      .then((res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          response.value = res;
          const result = res.data as Response<T>;
          data.value = result.data;
        } else if (res.statusCode === 401) {
        } else {
          uni.showToast({
            icon: "none",
            title: (res.data as Response<T>).msg || "请求错误",
          });
        }
      })
      .catch((e) => {
        error.value = e;
        uni.showToast({
          icon: "none",
          title: "网络错误",
        });
        throw new Error(e.errMsg as string | "网络错误");
      })
      .finally(() => {
        if (currentExecuteCounter === executeCounter) {
          loading(false);
        }
      });

    return promise;
  };

  if (immediate && url) {
    (execute as StrictUseRequestReturn<T, R, D>["execute"])();
  }

  const result = {
    response,
    data,
    error,
    isFinished,
    isLoading,
    execute,
  } as OverallUseRequestReturn<T, R, D>;

  return {
    ...result,
    ...promise,
  };
}
