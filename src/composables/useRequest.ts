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
  },
};
uni.addInterceptor("request", httpInterceptor);
uni.addInterceptor("uploadFile", httpInterceptor);

type RequestConfig = Partial<UniApp.RequestOptions>;
type RequestResponse = UniApp.RequestSuccessCallbackResult;
type RequestInstance = typeof uni.request;

interface UseRequestReturn<T, R = RequestResponse> {
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

interface StrictUseRequestReturn<T, R> extends UseRequestReturn<T, R> {
  execute: (
    url?: string | RequestConfig,
    config?: RequestConfig
  ) => Promise<StrictUseRequestReturn<T, R>>;
}

interface EasyUseRequestReturn<T, R> extends UseRequestReturn<T, R> {
  execute: (
    url: string,
    config?: RequestConfig
  ) => Promise<EasyUseRequestReturn<T, R>>;
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

type OverallUseRequestReturn<T, R> =
  | StrictUseRequestReturn<T, R>
  | EasyUseRequestReturn<T, R>;

export function useRequest<T = any, R = RequestResponse, D = any>(
  url: string,
  config?: RequestConfig,
  options?: UseRequestOptions
): StrictUseRequestReturn<T, R> & Promise<StrictUseRequestReturn<T, R>>;

export function useRequest<T = any, R = RequestResponse, D = any>(
  config?: RequestConfig
): EasyUseRequestReturn<T, R> & Promise<EasyUseRequestReturn<T, R>>;

export function useRequest<T = any, R = RequestResponse, D = any>(
  ...args: any[]
): OverallUseRequestReturn<T, R> & Promise<OverallUseRequestReturn<T, R>> {
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

  const {
    initialData,
    shallow,
    immediate,
    resetOnExecute = false,
    onSuccess,
    onError,
    onFinish,
  } = options;

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
    new Promise<OverallUseRequestReturn<T, R>>((resolve, reject) => {
      until(isFinished)
        .toBe(true)
        // eslint-disable-next-line ts/no-use-before-define
        .then(() => (error.value ? reject(error.value) : resolve(result)));
    });

  const promise = {
    then: (...args) => waitUntilFinished().then(...args),
    catch: (...args) => waitUntilFinished().catch(...args),
  } as Promise<OverallUseRequestReturn<T, R>>;

  let executeCounter = 0;

  const execute: OverallUseRequestReturn<T, R>["execute"] = (
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
          onSuccess?.(data.value);
        } else if (res.statusCode === 401) {
        } else {
          uni.showToast({
            icon: "none",
            title: (res.data as Response<T>).msg || "请求错误",
          });
          onError?.((res.data as Response<T>).msg || "请求错误");
        }
      })
      .catch((e) => {
        error.value = e;
        uni.showToast({
          icon: "none",
          title: "网络错误",
        });
        onError?.(e);
      })
      .finally(() => {
        if (currentExecuteCounter === executeCounter) {
          loading(false);
          onFinish?.();
        }
      });

    return promise;
  };

  if (immediate && url) {
    (execute as StrictUseRequestReturn<T, R>["execute"])();
  }

  const result = {
    response,
    data,
    error,
    isFinished,
    isLoading,
    execute,
  } as OverallUseRequestReturn<T, R>;

  return {
    ...result,
    ...promise,
  };
}
