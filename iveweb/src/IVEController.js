import { Colors } from 'flume';

// The ui is a way for the controller to manipulate things in the view.
// It is not the view itself.
// The view will call into the contoller saying that stuff happened.
// e.g. node was moved, node was clicked, etc.
// The controller is then responsible for manipulating the remote (if needed),
// maintaining some local state, and then calling the view to manipulate itself
// through the ui interface.
export async function IVEController(ui, graph_manip) {
    const colors = {
        'Double': Colors.blue,
        'Int32': Colors.green,
        'String': Colors.red,
        'Boolean': Colors.orange,
    };

    function colorPort(p) {
        return {
            ...p,
            color: colors[p.type]
        };
    }

    // App handles this now before creating the controller
    // var types = await remote.getTypes();
    // ui.setCreatableTypes(types);

    // Register for UI requests to create a node

    // UI callbacks are now subscribed to whatever system in the App
    // and called directly from the App.

    const createRequest = async (type, x, y, uiCreate) => {
        // manipulate the graph with this new node
        var created = await graph_manip.create(type, x, y);
        console.log(created);
        // returns a new node with the new id
        ui.addNode(created);

        return created;
    };

    const nodeMoved = (id, x, y) => graph_manip.moveNode(id, x, y);

    const removeRequest = async id => {
        await graph_manip.removeNode(id);
        ui.removeNode(id);
    }

    const portConnectRequest = async (fromid, fromport, toid, toport) => {
        // ask the remote to do this;
        await graph_manip.connect(fromid, fromport, toid, toport);
    }

    const portDisconnectRequest = (fromid, fromport, toid, toport) => {
        // ask the remote to do this;
        graph_manip.disconnect(fromid, fromport, toid, toport);
    }

    // Handle node selection
    // const nodeClicked = id => {
    //     if (selectedId) {
    //         ui.deselectNode(selectedId);
    //     }
    //     selectedId = id;
    //     ui.selectNode(id);
    //     return;
    // }

    // const stageClick = () => {
    //     if (selectedId) {
    //         ui.deselectNode(selectedId);
    //         selectedId = null;
    //     }
    //     if (poller) {
    //         clearInterval(poller);
    //     }
    // }

    const uiCreatedNode = (n, uiCreate) =>
        uiCreate(
            n.Id,
            n.Kind,
            [n.x, n.y],
            n.Inputs.map(colorPort),
            n.Outputs.map(colorPort))

    // Restore the current graph
    const g = graph_manip.getGraph();
    for (const n of g.Nodes) {
        ui.addNode(n);
    }


    const onmethods = {
        createRequest,
        removeRequest,
        nodeMoved,
        portConnectRequest,
        portDisconnectRequest,
        // nodeClicked,
        // stageClick,
        getGraph: () => graph_manip.getGraph()
    }
    return onmethods;
}
