import { v4 as uuidv4 } from 'uuid';

export function IVERemote() {
    var prefix = "/api/";
    const url = (path) => prefix + path;

    // This version keeps a local copy of the graph, modifies it internally,
    // and then sends it to the server in its entirety.
    var GRAPH = { nodes: [], connections: [] };
    var GRAPHDTO = { Nodes: [], Connections: [] };

    const save = () => {
        console.log("saveing");
        console.log(GRAPH);
        localStorage.setItem("GRAPH", JSON.stringify(GRAPH));
    }

    const dtoToPort = (p) => ({
        name: p.Name,
        type: p.Kind
    });

    const dtoToNode = (dto) => ({
        title: dto.Kind,
        id: dto.Id,
        x: dto.x,
        y: dto.y,
        inputs: dto.Inputs.map(dtoToPort),
        outputs: dto.Outputs.map(dtoToPort)
    });

    const dtoToConnection = (dto) => ({
        fromId: dto.From,
        fromPort: dto.OutputPort,
        toId: dto.To,
        toPort: dto.InputPort

    });

    const dtoToLocalGraph = (dto) => ({
        nodes: dto.Nodes.map(dtoToNode),
        connections: dto.Connections.map(dtoToConnection)
    });

    const nodeToDTO = (n) => ({
        Kind: n.title,
        Id: n.id,
    })

    const connectionToDTO = (c) => ({
        FromId: c.fromId,
        FromPort: c.fromPort,
        ToId: c.toId,
        ToPort: c.toPort
    })

    const LocalGraphToDTO = (g) => ({
        Nodes: g.nodes.map(nodeToDTO),
        Connections: g.connections.map(connectionToDTO)
    })

    try {
        const g = JSON.parse(localStorage.getItem("GRAPH"));
        if (g) {
            console.log(g);
            GRAPH = g;
            GRAPHDTO = LocalGraphToDTO(GRAPH);
            console.log("Restored stored graph")
        } else {
            localStorage.removeItem("GRAPH");
            console.log("No stored graph")
        }
    } catch (e) {
        localStorage.removeItem("GRAPH");
        console.log("error restoring graph")
        console.log(e);
    }


    const post = async (path, data) => {
        const res = await fetch(url(path), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        return await res.json();
    };

    const get = (path) => {
        return fetch(url(path)).then(res => res.json());
    };

    const get_typeinfo = async (kind) => {
        const q = encodeURIComponent(JSON.stringify([kind]));
        return await get(`typeinfo?q=${q}`);
    }

    const ModifyDTO = (changes) => ({
        ...GRAPHDTO,
        ...changes
    })

    const create = async (kind, x, y) => {
        const dtonode = {
            Id: uuidv4(),
            Kind: kind
        }
        // Create a new remote graph
        const pendingdto = ModifyDTO({
            Nodes: [...GRAPHDTO.Nodes, dtonode]
        });
        // See if the remote can create it
        const res = await post("command", pendingdto);

        // Get the description of the node from the server
        const desc = (await get_typeinfo(kind))[0];

        desc.x = x;
        desc.y = y;
        desc.Id = dtonode.Id;

        console.log(`desc: ${JSON.stringify(desc)}`);

        const graphnode = dtoToNode(desc);

        // If we get here, the create was successful
        // Update our graph
        GRAPHDTO = pendingdto;
        GRAPH.nodes = [...GRAPH.nodes, graphnode];

        save();

        return graphnode;
    }

    const connect = async (fromId, fromPort, toId, toPort) => {
        // Add this connection to the DTO graph
        // Create a new remote graph
        const newconnection = {
            From: fromId,
            OutputPort: fromPort,
            To: toId,
            InputPort: toPort
        }
        const pendingdto = ModifyDTO({ Connections: [...GRAPHDTO.Connections, newconnection] });

        console.log(JSON.stringify(pendingdto));

        // Post this and hope for the best
        const res = await post("command", pendingdto);
        console.log(res);

        // Woohoo, it worked!  We lucked out on that didn't we
        GRAPHDTO = pendingdto;
        GRAPH.connections = [...GRAPH.connections, dtoToConnection(newconnection)];

        save();
    }

    return {
        getTypes: () => get('types'),
        create: create,
        moveNode: (id, x, y) => {
            console.log(GRAPH);
            const node = GRAPH.nodes.find(n => n.id === id);
            node.x = x;
            node.y = y;
            save();
        },
        getGraph: () => GRAPH,
        // getGraph: () => post("graph")
        //     .then(graph => ({
        //         nodes: graph.Nodes.map(dtoToNode),
        //         connections: graph.Connections.map(dtoToConnection)
        //     })),
        removeNode: async id => {
            const nodes_without_id = GRAPH.nodes.filter(n => n.Id !== id);

            const pendingdto = ModifyDTO({ Nodes: nodes_without_id });

            // Try it
            await post("command", pendingdto)

            // Remove it from our local graph
            GRAPH.nodes = GRAPH.nodes.filter(n => n.id !== id);
            save();
        },
        connect: connect,
        disconnect: async (fromid, fromname, toid, toname) => {
            const pendingdto = ModifyDTO({ Connections: GRAPHDTO.Connections.filter(c => c.FromId !== fromid || c.ToId !== toid) });
            await post("command", pendingdto);
            GRAPHDTO = pendingdto;
            GRAPH.connections = GRAPH.connections.filter(c => c.fromId !== fromid || c.toId !== toid);
            save();
        },
        getState: id => post("state", {
            Id: id
        })
    };
}
