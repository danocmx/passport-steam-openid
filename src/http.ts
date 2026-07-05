import { HttpOpts, HttpRes, IAxiosLikeHttpClient } from './type';

export class FetchHttpClient implements IAxiosLikeHttpClient {
  public async get<TResponse>(
    urlString: string,
    opts?: HttpOpts,
  ): Promise<HttpRes<TResponse>> {
    const [url, headers, redirect] = this.prepareRequest(urlString, opts);
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect,
    });

    return this.getBody(response);
  }

  public async post<TResponse>(
    urlString: string,
    data?: any,
    opts?: HttpOpts,
  ): Promise<HttpRes<TResponse>> {
    const [url, headers, redirect] = this.prepareRequest(urlString, opts);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      redirect,
      body: data,
    });

    return this.getBody(response);
  }

  private prepareRequest(
    urlString: string,
    opts?: HttpOpts,
  ): [URL, Headers, RequestRedirect] {
    if (opts?.maxRedirects && opts.maxRedirects != 0) {
      // Currently only 0 is used
      throw new Error(
        `Fetch client cannot handle maxRedirect=${opts.maxRedirects} setting.`,
      );
    }

    const url = new URL(urlString);

    if (opts?.params) {
      for (const name of Object.keys(opts.params)) {
        url.searchParams.append(name, opts.params[name]);
      }
    }

    const headers = new Headers(opts?.headers);
    return [url, headers, opts?.maxRedirects == 0 ? 'error' : 'follow'];
  }

  private async getBody<T>(
    res: Response,
  ): Promise<{ status: number; data: T }> {
    if (res.headers.get('Content-Type') == 'text/json') {
      return {
        data: (await res.json()) as any,
        status: res.status,
      };
    }

    return {
      data: (await res.text()) as any,
      status: res.status,
    };
  }
}
