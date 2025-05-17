const API_HOST = "http://localhost:8090";

const verify_token = async (logout_href) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token found in localStorage");
    }

    const resp = await fetch(`${API_HOST}/api/auth/verify-token`, {
      method: "POST",
      body: JSON.stringify({
        access_token: token,
        token_type: "bearer",
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      //   throw new Error(`HTTP error! status: ${resp.status}`);
      localStorage.clear();
      location.href = logout_href;
    }

    const data = await resp.json();
    console.log(data);
    if (data["status"] == "failure") {
      localStorage.clear();
      location.href = "index.html";
    }
  } catch (error) {
    console.error("Token verification failed:", error.message);
    localStorage.clear();
    location.href = "index.html";
    // throw error;
  }
};

const fetch_profile = async () => {
  const fetch_url = `${API_HOST}/api/customer/${localStorage.getItem(
    "user_id"
  )}/profile`;
  const token = localStorage.getItem("token");
  const resp = await fetch(fetch_url, {
    method: "GET",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const status = resp.status;
  const json = await resp.json();

  console.log(json);
  localStorage.setItem("user_profile", JSON.stringify(json));
};

const getUrlParams = () => {
  const params = {};
  const queryString = window.location.search.slice(1); // remove '?'
  const pairs = queryString.split("&");

  for (const pair of pairs) {
    if (!pair) continue;
    const [key, value] = pair.split("=").map(decodeURIComponent);
    params[key] = value;
  }

  return params;
};

const fetch_profile_staff = async () => {
  const fetch_url = `${API_HOST}/api/staff/${localStorage.getItem(
    "user_id"
  )}/profile`;
  const token = localStorage.getItem("token");
  const resp = await fetch(fetch_url, {
    method: "GET",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const status = resp.status;
  const json = await resp.json();

  console.log(json);
  localStorage.setItem("user_profile", JSON.stringify(json));
  // localStorage.setItem("user")
};
