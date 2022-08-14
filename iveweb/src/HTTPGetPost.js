const http_get = async (url) => {
    const response = await fetch(url);
    return await response.json();
}
const http_post = async (url, data) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
    return await response.json();
}
export {
    http_get,
    http_post
}