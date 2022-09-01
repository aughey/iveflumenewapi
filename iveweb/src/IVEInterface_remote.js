const prefix = "/api/";
const url = (path) => prefix + path;

export function IVEInterface(provided_get, provided_post) {
    const get = (path) => provided_get(url(path));
    const post = (path, data) => provided_post(url(path), data);

    const command = async (graph) => {
        console.log("Remote Sending Graph:");
        console.log(graph);

        var ret = await post("command", graph);
        if (ret.Error) {
            throw new Error(ret.Error);
        }
        return ret;
    }

    return {
        getTypes: () => get('types'),
        setGraph: graph => command(graph),
        getTypeInfo: types => get("typeinfo?q=" + encodeURIComponent(JSON.stringify(types))),
    };
}

