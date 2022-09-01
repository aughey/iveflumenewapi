import { v4 as uuidv4 } from 'uuid';

export default async function IVEManip(storage, remote) {
    // Possibly load this from persistant storage

    const setGraph = async (graph) => {
        console.log("IVEManip sending graph...")
        console.log(graph);
        var ret = await remote.setGraph(graph);
        save(graph);
        return ret;
    }

    var GRAPH = await RestoreGraph(storage);

    // Update the graph with typeinfo
    // Could fail, reset graph if it does
    try {
        if (GRAPH.Nodes.length > 0) {
            const nodetypes = await remote.getTypeInfo(GRAPH.Nodes.map(n => n.Kind));
            for (var i = 0; i < GRAPH.Nodes.length; i++) {
                delete nodetypes[i].Id
                GRAPH.Nodes[i] = {
                    ...GRAPH.Nodes[i],
                    ...nodetypes[i]
                }
            }
        }
    } catch (e) {
        GRAPH = {
            Nodes: [],
            Connections: []
        };
    }

    // Load that graph on the remote
    console.log("IVEManip setting initial graph")
    await remote.setGraph(GRAPH);


    const save = (graph) => {
        const tosave = JSON.stringify(graph);
        console.log("saved")
        console.log(graph);
        // console.log(tosave);
        storage.setItem("GRAPH", tosave);

        const stored = storage.getItem("GRAPH")
        console.log("stored")
        console.log(JSON.parse(stored));
    }

    const CreateMod = (changes) => ({
        ...GRAPH,
        ...changes
    })

    const create = async (kind, x, y) => {
        const dtonode = {
            Id: uuidv4(),
            Kind: kind,
            x: x,
            y: y
        }
        // Create a new remote graph
        const pending = CreateMod({
            Nodes: [...GRAPH.Nodes, dtonode]
        });
        // See if the remote can create it
        const ret = await setGraph(pending);

        //console.log(ret);

        // Get the description of the node from the server
        const desc = (await remote.getTypeInfo([kind]))[0];

        desc.Id = dtonode.Id;
        desc.x = x;
        desc.y = y;

        dtonode.Inputs = desc.Inputs;
        dtonode.Outputs = desc.Outputs;

        //console.log(desc);
        //console.log(dtonode);

        // If we get here, the create was successful
        // Update our graph
        GRAPH = pending;

        //console.log(GRAPH);

        return desc;
    }

    const setNodeState = async (id, value) => {
        // Create a new graph with the this node having a new id
        const newid = uuidv4();
        const pending = reIdNode(GRAPH, id, newid);
        const node = pending.Nodes.find(n => n.Id === newid);
        // it is ok to write directly to this because it's a copy
        node.Properties = {
            ...node.Properties,
            State: value
        }

        // See if the remote can create it
        await setGraph(pending);
        // If we get here, the create was successful
        GRAPH = pending;

        return node;
    }

    function reIdNode(graph, id, newid) {
        const oldnode = graph.Nodes.find(n => n.Id === id);
        const newnode = {
            ...oldnode,
            Id: newid
        }
        const rewriteconnection = c => {
            if (c.To === id) {
                return {
                    ...c,
                    To: newid
                }
            } else if (c.From === id) {
                return {
                    ...c,
                    From: newid
                }
            } else {
                // nothing to do
                return c;
            }
        }

        return {
            // Nodes without the old and with the new
            Nodes: [...graph.Nodes.filter(n => n.Id !== id), newnode],
            // Connections rewritten to use the new to id and with the new connection
            Connections: [...graph.Connections.map(rewriteconnection)]
        };
    }

    return {
        getGraph: () => GRAPH,
        moveNode: (id, x, y) => {
            console.log("moving node", id, x, y);
            const n = GRAPH.Nodes.find(n => n.Id === id);
            n.x = x;
            n.y = y;
            save(GRAPH);  // we need to manually save it here
        },
        connect: async (fromid, output, toid, input) => {
            // We must create a new ID for the to object in order
            // for it to rebuild properly.  re-id it, and then
            // remap the connections.
            const oldto = GRAPH.Nodes.find(n => n.Id === toid);
            const newto = {
                ...oldto,
                Id: uuidv4()
            }
            const rewriteconnection = c => {
                if (c.To === toid) {
                    return {
                        ...c,
                        To: newto.Id
                    }
                } else if (c.From === toid) {
                    return {
                        ...c,
                        From: newto.Id
                    }
                } else {
                    // nothing to do
                    return c;
                }
            }

            console.log("New to id: " + newto.Id);

            const newconnection = {
                From: fromid,
                OutputPort: output,
                To: newto.Id,
                InputPort: input
            }
            var pending = CreateMod({
                // Nodes without the old and with the new
                Nodes: [...GRAPH.Nodes.filter(n => n.Id !== toid), newto],
                // Connections rewritten to use the new to id and with the new connection
                Connections: [...GRAPH.Connections.map(rewriteconnection), newconnection]
            });
            console.log("Trying to connect graph");
            console.log(pending);
            const ret = await setGraph(pending);
            GRAPH = pending;
            return ret;
        },
        disconnect: async (fromid, output, toid, input) => {
            const thisConnection = c => c.From === fromid && c.OutputPort === output && c.To === toid && c.InputPort === input;
            const without = GRAPH.Connections.filter(c => !thisConnection(c));

            var pending = CreateMod({
                Connections: without
            });
            const ret = await setGraph(pending);
            GRAPH = pending;
            return ret;
        },
        removeNode: async id => {
            const without = GRAPH.Nodes.filter(n => n.Id !== id);
            const connections_without = GRAPH.Connections.filter(c => c.From !== id && c.To !== id);
            var pending = CreateMod({
                Nodes: without,
                Connections: connections_without
            });
            const ret = await setGraph(pending);
            GRAPH = pending;
            return ret;
        },
        create,
        setNodeState
    }
}

const RestoreGraph = async (storage) => {
    try {
        const g = JSON.parse(await storage.getItem("GRAPH"));
        if (g) {
            console.log("Restored stored graph")
            console.log(g);
            return g;
        } else {
            storage.removeItem("GRAPH");
            console.log("No stored graph")
        }
    } catch (e) {
        console.log("error restoring graph")
        console.log(e);
        storage.removeItem("GRAPH");
    }

    // Our persistant version of the graph.
    return {
        Nodes: [],
        Connections: []
    }
}    