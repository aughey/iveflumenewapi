
// The ui is a way for the controller to manipulate things in the view.
// It is not the view itself.
// The view will call into the contoller saying that stuff happened.
// e.g. node was moved, node was clicked, etc.
// The controller is then responsible for manipulating the remote (if needed),
// maintaining some local state, and then calling the view to manipulate itself
// through the ui interface.
export async function IVEController(ui, graph_manip, inspector) {

    // App handles this now before creating the controller
    // var types = await remote.getTypes();
    // ui.setCreatableTypes(types);

    // Register for UI requests to create a node

    // UI callbacks are now subscribed to whatever system in the App
    // and called directly from the App.
    const createRequest = async (type, x, y) => {
        // manipulate the graph with this new node
        var created = await graph_manip.create(type, x, y);

        console.log("Create request: " + type + " at " + x + "," + y);
        console.log(created);

        ui.addNode(created);

        ui.info("Created node " + type);

        return created;
    };

    const nodeMoved = (id, x, y) => graph_manip.moveNode(id, x, y);

    const removeRequest = async id => {
        await graph_manip.removeNode(id);
        if (selectedId === id) {
            stageClicked();
        }
        ui.removeNode(id);
    }

    const colorUI = (graph, ret) => {
        console.log("Coloring");
        console.log(ret);
        for (const node of graph.nodes) {

        }
    }

    const rebuildGraph = (prevgraph, newgraph) => {

        // Clear out the old graph and rebuild it
        for (const n of prevgraph.Nodes) {
            ui.removeNode(n.Id);
        }
        for (const n of newgraph.Nodes) {
            ui.addNode(n);
        }
        for (const c of newgraph.Connections) {
            ui.connect(c.From, c.OutputPort, c.To, c.InputPort);
        }
    }

    const portConnectRequest = async (fromid, fromport, toid, toport) => {
        console.log("portConnectRequest", fromid, fromport, toid, toport);
        // ask the remote to do this;
        const prevgraph = graph_manip.getGraph();

        await graph_manip.connect(fromid, fromport, toid, toport);

        stageClicked();

        const newgraph = graph_manip.getGraph();

        rebuildGraph(prevgraph, newgraph);

    }

    const portDisconnectRequest = async (fromid, fromport, toid, toport) => {
        // ask the remote to do this;
        await graph_manip.disconnect(fromid, fromport, toid, toport);
        ui.disconnect(fromid, fromport, toid, toport);
        stageClicked()
    }

    // Handle node selection
    let selectedId;

    const nodeClicked = id => {
        if (selectedId) {
            ui.deselectNode(selectedId);
            inspector.show([])
        }
        selectedId = id;
        ui.selectNode(id);
        inspector.show([getNode(id)])
        return;
    }

    const stageClicked = () => {
        if (selectedId) {
            ui.deselectNode(selectedId);
            selectedId = null;
            inspector.show([])
        }
    }

    const getNode = id => graph_manip.getGraph().Nodes.find(n => n.Id === id);

    // Restore the current graph
    const g = graph_manip.getGraph();
    for (const n of g.Nodes) {
        ui.addNode(n);
    }
    for (const c of g.Connections) {
        ui.connect(c.From, c.OutputPort, c.To, c.InputPort);
    }

    const setNodeState = async (id, value) => {
        stageClicked();

        // setNodeState will set the state by creating a new node and deleting the old one
        const newnode = await graph_manip.setNodeState(id, value);

        // Remove this from the UI
        ui.removeNode(id);

        // Add a new one back in
        ui.addNode(newnode);

        ui.info(`Set node ${id} to ${value}`);

        // Silly hack because the node seems to need to be removed first after an update cycle
        // in Flume (we shouldn't know this).
        setTimeout(() => {
            const myConnection = c => c.From === newnode.Id || c.To === newnode.Id;

            for (const c of graph_manip.getGraph().Connections.filter(myConnection)) {
                ui.connect(c.From, c.OutputPort, c.To, c.InputPort);
            }
        }, 0);

        // Re-select it
        nodeClicked(newnode.Id);
    }



    const onmethods = {
        createRequest,
        removeRequest,
        nodeMoved,
        portConnectRequest,
        portDisconnectRequest,
        nodeClicked,
        stageClicked,
        setNodeState,
        getGraph: () => graph_manip.getGraph()
    }
    return onmethods;
}
