const prefix = "/api/";
const url = (path) => prefix + path;

// little function to serialize all calls
function CreateSerializer() {
    const pending = [];
    var waiting = false;

    const checkRun = async () => {
        if (waiting) {
            return;
        }
        while (pending.length > 0) {
            waiting = true;
            const torun = pending.shift();
            await torun();
        }
        waiting = false;
    }

    const serialize = (fn) => {
        return new Promise((resolve, reject) => {
            pending.push(async () => {
                try {
                    resolve(await fn())
                } catch (e) {
                    reject(e);
                }
            });
            checkRun();
        })
    }
    return serialize;
}

export function IVEInterface(provided_get, provided_post) {
    const get = (path) => provided_get(url(path));
    const post = (path, data) => provided_post(url(path), data);

    const serialize = CreateSerializer();

    const command = (graph) => {
        return serialize(async () => {
            var ret = await post("command", graph);
            if(ret.Error) {
                throw new Error(ret.Error);
            }
            return ret;
        })
    }

    return {
        getTypes: () => get('types'),
        setGraph: graph => command(graph),
        getTypeInfo: types => get("typeinfo?q=" + encodeURIComponent(JSON.stringify(types))),
    };
}

