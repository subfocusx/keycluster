use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv6Addr};
use url::Url;

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct HttpRequest {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_method() -> String {
    "GET".to_string()
}

fn default_timeout() -> u64 {
    30
}

fn is_private_host(host: &str) -> bool {
    let host_lower = host.to_lowercase();
    if host_lower == "localhost" {
        return true;
    }
    if let Ok(ip) = host_lower.parse::<IpAddr>() {
        match ip {
            IpAddr::V4(v4) => {
                let o = v4.octets();
                match o[0] {
                    0 | 10 | 127 => true,
                    169 if o[1] == 254 => true,
                    172 if (16..=31).contains(&o[1]) => true,
                    192 if o[1] == 168 => true,
                    _ => false,
                }
            }
            IpAddr::V6(v6) => v6 == Ipv6Addr::LOCALHOST || v6 == Ipv6Addr::UNSPECIFIED,
        }
    } else {
        false
    }
}

fn validate_url(url_str: &str) -> Result<(), String> {
    let parsed =
        Url::parse(url_str).map_err(|_| "SSRF_BLOCKED: invalid URL".to_string())?;

    match parsed.scheme() {
        "http" | "https" => {}
        "file" => return Err("SSRF_BLOCKED: file:// protocol is not allowed".to_string()),
        other => {
            return Err(format!(
                "SSRF_BLOCKED: protocol '{}' is not allowed",
                other
            ))
        }
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "SSRF_BLOCKED: URL has no host".to_string())?;

    if is_private_host(host) {
        return Err(format!(
            "SSRF_BLOCKED: requests to private/internal addresses are not allowed: {}",
            host
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    validate_url(&request.url)?;

    let timeout_secs = request.timeout_secs.min(30);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .danger_accept_invalid_certs(false)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                return attempt.error("SSRF_BLOCKED: too many redirects");
            }
            if let Some(host) = attempt.url().host_str() {
                if is_private_host(host) {
                    return attempt.error("SSRF_BLOCKED: redirect to private address");
                }
            }
            attempt.follow()
        }))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let method = request.method.to_uppercase();

    let req = match method.as_str() {
        "GET" => client.get(&request.url),
        "POST" => {
            let mut r = client.post(&request.url);
            if let Some(body) = &request.body {
                r = r.body(body.clone());
            }
            r
        }
        "PUT" => {
            let mut r = client.put(&request.url);
            if let Some(body) = &request.body {
                r = r.body(body.clone());
            }
            r
        }
        "DELETE" => client.delete(&request.url),
        "PATCH" => {
            let mut r = client.patch(&request.url);
            if let Some(body) = &request.body {
                r = r.body(body.clone());
            }
            r
        }
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    let req = req.headers({
        let mut h = reqwest::header::HeaderMap::new();
        for (key, value) in &request.headers {
            if let (Ok(name), Ok(val)) = (
                reqwest::header::HeaderName::from_bytes(key.as_bytes()),
                reqwest::header::HeaderValue::from_str(value),
            ) {
                h.insert(name, val);
            }
        }
        h
    });

    let response = req.send().await.map_err(|e| {
        if e.is_timeout() {
            format!("Timeout after {}s", timeout_secs)
        } else if e.is_connect() {
            format!("Connection failed: {}", e)
        } else {
            format!("Request failed: {}", e)
        }
    })?;

    let status = response.status().as_u16();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(HttpResponse {
        status,
        body,
        headers: response_headers,
        url: request.url,
    })
}
