import { v4 as uuidv4 } from 'uuid';

export default async function IVEManip(storage, remote) {
    // Possibly load this from persistant storage

    var GRAPH = await RestoreGraph(storage);

    // Update the graph with typeinfo
    // Could fail, reset graph if it does
    try {
        if (GRAPH.Nodes.length > 0) {
            const nodetypes = await remote.getTypeInfo(GRAPH.Nodes.map(n => n.Kind));
            for (var i = 0; i < GRAPH.Nodes.length; i++) {
                GRAPH.Nodes[i] = {
                    ...nodetypes[i],
                    Id: GRAPH.Nodes[i].Id,
                    x: GRAPH.Nodes[i].x,
                    y: GRAPH.Nodes[i].y,
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
    await remote.setGraph(GRAPH);
   

    const save = () => {
        const tosave = JSON.stringify(GRAPH);
        console.log("saved")
       // console.log(tosave);
        storage.setItem("GRAPH", tosave);
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
        const ret = await remote.setGraph(pending);
        
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

        save();

        return desc;
    }

    return {
        getGraph: () => GRAPH,
        moveNode: (id, x, y) => {
            console.log("moving node", id, x, y);
            const n = GRAPH.Nodes.find(n => n.Id === id);
            n.x = x;
            n.y = y;
            save();
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
                if(c.To === toid) {
                    return {
                        ...c,
                        To: newto.Id
                    }
                } else if(c.From === toid) {
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
            const ret = await remote.setGraph(pending);
            GRAPH = pending;
            save();
            return ret;
        },
        disconnect: async (fromid, output, toid, input) => {
            const without = GRAPH.Connections.filter(c => c.FromId !== fromid && c.OutputPort !== output && c.ToId !== toid && c.InputPort !== input);

            var pending = CreateMod({
                Connections: without
            });
            const ret = await remote.setGraph(pending);
            GRAPH = pending;
            save();
            return ret;
        },
        removeNode: async id => {
            const without = GRAPH.Nodes.filter(n => n.Id !== id);
            const connections_without = GRAPH.Connections.filter(c => c.From !== id && c.To !== id);
            var pending = CreateMod({
                Nodes: without,
                Connections: connections_without
            });
            const ret = await remote.setGraph(pending);
            GRAPH = pending;
            save();
            return ret;
        },
        create
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