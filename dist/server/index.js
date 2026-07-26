export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && !url.pathname.split("/").pop().includes(".")) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}.html`;
      response = await env.ASSETS.fetch(new Request(url, request));
    }
    return response;
  },
};
