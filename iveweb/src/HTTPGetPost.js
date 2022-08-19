const http_get = async (url) => {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            mode: 'cors',
            headers: {
              'Access-Control-Allow-Origin':'*'
            }
        }
    });
    return await response.json();
}
const http_post = async (url, data) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            mode: 'cors',
            headers: {
              'Access-Control-Allow-Origin':'*'
            }
        },
        body: JSON.stringify(data)
    });
    return await response.json();
}
export {
    http_get,
    http_post
}