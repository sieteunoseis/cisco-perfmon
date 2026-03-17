export interface PerfmonOptions {
  Cookie?: string;
  [key: string]: string | undefined;
}

export interface PerfmonResult {
  cookie: string;
  results: any;
}

export interface PerfmonCounterResult extends PerfmonResult {
  object: string;
}

export interface CounterData {
  host: string;
  object: string;
  instance: string;
  counter: string;
  value: string;
  cstatus: string;
}

export interface CounterInfo {
  Name: string;
  MultiInstance: string;
  ArrayOfCounter?: {
    Counter: Array<{
      Name: string;
    }>;
  };
}

export interface CounterDescription {
  Description: string;
  Name: string;
}

export interface Counter {
  host: string;
  object: string;
  instance?: string;
  counter: string;
}

declare class perfMonService {
  constructor(
    host: string,
    username: string,
    password: string,
    options?: PerfmonOptions,
    retry?: boolean
  );

  /**
   * Get the current stored cookie
   */
  getCookie(): string;

  /**
   * Set a cookie to be used for subsequent requests
   */
  setCookie(cookie: string): void;

  /**
   * Collect counter data without a session
   */
  collectCounterData(
    host: string,
    object: string
  ): Promise<{
    cookie: string;
    object: string;
    results: CounterData[] | CounterData | string;
  }>;

  /**
   * Collect data for an open session
   */
  collectSessionData(
    SessionHandle: string
  ): Promise<{
    cookie: string;
    results: CounterData[] | CounterData | string;
  }>;

  /**
   * List available counters on a host
   */
  listCounter(
    host: string,
    filtered?: string[]
  ): Promise<{
    cookie: string;
    results: CounterInfo[] | string;
  }>;

  /**
   * List instances of a perfmon object on a host
   */
  listInstance(
    host: string,
    object: string
  ): Promise<{
    cookie: string;
    object: string;
    results: any[] | string;
  }>;

  /**
   * Open a perfmon session
   */
  openSession(): Promise<{
    cookie: string;
    results: string;
  }>;

  /**
   * Close a perfmon session
   */
  closeSession(
    sessionHandle: string
  ): Promise<{
    cookie: string;
    results: "success";
  }>;

  /**
   * Add counter(s) to a session
   */
  addCounter(
    sessionHandle: string,
    counter: Counter | Counter[]
  ): Promise<{
    cookie: string;
    results: "success";
  }>;

  /**
   * Remove counter(s) from a session
   */
  removeCounter(
    sessionHandle: string,
    counter: Counter | Counter[]
  ): Promise<{
    cookie: string;
    results: "success";
  }>;

  /**
   * Get counter description
   */
  queryCounterDescription(
    object: Counter
  ): Promise<{
    cookie: string;
    object: string;
    results: CounterDescription | string;
  }>;
}

export = perfMonService;
