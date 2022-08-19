const url = 'ws://localhost:4000/ws';


export async function IVEInterface_ws() {

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

