const raw_regexp =
  /(--[a-zA-Z\-]{1,} '(.{1,})')|(--[a-zA-Z\-]{1,})|(-[a-zA-Z\-]+? '.+?')|('?[a-z]+:\/\/.*?'+?)|("?[a-z]+:\/\/.*?"+?)/g; // eslint-disable-line
const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/; // eslint-disable-line
const urlInLocationRegex =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/; // eslint-disable-line

type CurlCommandPayload = {
  url: string;
  headers: Record<string, string>;
};

function is_start_with(texts: string[], text: string) {
  for (let i = 0; i < texts.length; i += 1) {
    if (text.startsWith(texts[i])) {
      return true;
    }
  }
  return false;
}

const removeLeadingTrailingQuotes = (str: string) => {
  const quotes = [`'`, `"`];
  const newStr = str.trim();
  return quotes.includes(newStr[0]) ? newStr.substr(1, newStr.length - 2) : newStr;
};

function subStrFrom(val: string, startFromVal: string) {
  const dataPosition = val.indexOf(startFromVal);
  return val.substr(dataPosition);
}

function isJsonRequest(headers: CurlCommandPayload["headers"]) {
  const value = headers["content-type"] || headers["Content-Type"];
  if (!value) {
    return false;
  }
  return value.toUpperCase() === "APPLICATION/JSON";
}

function parse_body_by_content_type(data: CurlCommandPayload, body: string) {
  const { headers } = data;
  if (!body) {
    return body;
  }
  const is_json_request = isJsonRequest(headers);
  // console.log(
  //   "[]parse_body_by_content_type before if (!is_json_request)",
  //   is_json_request,
  //   body
  // );
  if (!is_json_request) {
    return body;
  }
  try {
    //     const normalized_body = body.replace('\\"', '"').replace("\\'", "'");
    const normalized_body = body;
    return JSON.parse(normalized_body);
  } catch (ex) {
    const err = ex as Error;
    // ignore json conversion error..
    // console.log("Cannot parse JSON Data " + err.message); // eslint-disable-line
  }
  return body;
}

export function parse_header_raw(raw: string) {
  let text = raw;
  text = text.replace(/--{0,1}[a-zA-Z\-]{1,} /, "");
  text = text.replace(/^['"]/, "");
  text = text.replace(/['"]$/, "");
  const [key, value] = text.split(": ");
  return {
    key: key.trim(),
    value: (() => {
      //       if (value.match(/^['"]/)) {
      //         return value.replace(/^['"]/, "").replace(/['"]$/, "");
      //       }
      return value;
    })(),
  };
}

/** 解析 cookie */
export function parse_cookie_raw(raw: string) {
  let text = raw.replace(/-b /, "");
  text = text.replace(/^['"]/, "");
  text = text.replace(/['"]$/, "");
  const segments = text.split(/; {0,1}/);
  return segments.map((segment) => {
    const [key, value] = segment.split("=");
    return {
      key,
      value,
    };
  });
}

function search_to_query(url: string) {
  const paramPosition = url.indexOf("?");
  const query: Record<string, string | number> = {};
  if (paramPosition !== -1) {
    // const splitUrl = parsedCommand.url.substr(0, paramPosition);
    const paramsString = url.substr(paramPosition + 1);
    const params = paramsString.split("&") || [];

    params.forEach((param) => {
      const splitParam = param.split("="); // eslint-disable-line
      const [key, value] = splitParam;
      if (key) {
        query[key] = value || ""; // eslint-disable-line
      }
    });
  }
  return query;
}

function parse_url_raw(val: string) {
  const urlMatches = val.match(urlRegex) || [];
  if (urlMatches.length) {
    const url = urlMatches[0]; // eslint-disable-line
    if (url) {
      return {
        url,
        query: search_to_query(url),
      };
    }
  }
  return { url: "", query: {} };
}
function parse_location_raw(val: string) {
  const urlMatches = val.match(urlInLocationRegex) || [];
  if (urlMatches.length) {
    const url = urlMatches[0]; // eslint-disable-line
    if (url) {
      return {
        url,
        query: search_to_query(url),
      };
    }
  }
  return { url: "", query: {} };
}
function parse_body_raw(val: string) {
  return removeLeadingTrailingQuotes(subStrFrom(val, " "));
}

function is_valid_curl_command(val: string) {
  return val.trim().startsWith("curl ");
}
function is_url_raw(val: string) {
  const matches = val.match(urlRegex) || [];
  return !!matches.length;
}
function is_location_raw(str: string) {
  return is_start_with(["--location "], str);
}
function is_header_raw(str: string) {
  return is_start_with(["-H ", "--headers ", "--header "], str);
}
function is_cookie_raw(str: string) {
  return is_start_with(["-b "], str);
}
function is_data_raw(str: string) {
  return is_start_with(["-d ", "--data ", "--data-ascii ", "--data-raw ", "--data-urlencode ", "--data-binary "], str);
}

export function parse(command: string) {
  const parsedCommand: {
    url: string;
    method: "POST" | "GET" | "PUT" | "DELETE" | "OPTION";
    query: Record<string, string | number>;
    headers: Record<string, string>;
    cookies: { key: string; value: string }[];
    body: Record<string, unknown>;
  } = {
    url: "",
    method: "GET",
    query: {},
    headers: {},
    body: {},
    cookies: [],
  };
  if (!command) {
    return parsedCommand;
  }
  // quit if the command does not starts with curl
  if (!is_valid_curl_command(command)) {
    return parsedCommand;
  }
  const matches = command.match(raw_regexp);
  if (!matches) {
    return parsedCommand;
  }
  for (let i = 0; i < matches.length; i += 1) {
    const val = matches[i];
    (() => {
      const raw_line = removeLeadingTrailingQuotes(val);
      // console.log("raw line", raw_line);
      if (is_url_raw(raw_line)) {
        const { url, query } = parse_url_raw(raw_line);
        parsedCommand.url = url;
        parsedCommand.query = query;
        return;
      }
      if (is_location_raw(raw_line)) {
        const { url, query } = parse_location_raw(raw_line);
        parsedCommand.url = url;
        parsedCommand.query = query;
        return;
      }
      if (is_header_raw(raw_line)) {
        const { key, value } = parse_header_raw(raw_line);
        if (key.match(/[cC]ookie/)) {
          const cookies = parse_cookie_raw(value);
          parsedCommand.cookies = [...parsedCommand.cookies, ...cookies];
          return;
        }
        parsedCommand.headers[key] = value;
        return;
      }
      if (is_cookie_raw(raw_line)) {
        const cookies = parse_cookie_raw(raw_line);
        parsedCommand.cookies = [...parsedCommand.cookies, ...cookies];
        return;
      }
      if (is_data_raw(raw_line)) {
        const body = parse_body_raw(raw_line);
        parsedCommand.body = parse_body_by_content_type(parsedCommand, body);
        return;
      }
      // console.log(`Skipped Header ${val}`); // eslint-disable-line
    })();
  }
  // should be checked after all the options are analyzed
  // so that we guarentee that we have content-type header
  return parsedCommand;
}
