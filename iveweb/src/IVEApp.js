import { NodeEditor } from "flume";
import { FlumeConfig, Colors, Controls } from 'flume'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.css';
import { CreateAPI } from "./CreateAPI";
import RemoteInterface from "./RemoteInterface";
import _, { create, remove } from "lodash";
import { IVEController } from "./IVEController";
import { IVEInterface } from "./IVEInterface_remote";
import IVEManip from "./IVEManip";


const config = new FlumeConfig();

function Top() {
    return (
        <div style={{ width: 1600, height: 900 }}>
            <GraphBinder />
        </div>
    );
}

// This function will orchestrate setting up the graph visual, the connection to the
// remote host, and the controller.
function GraphBinder() {
    const [flumeapi, setFlumeAPI] = useState(null);

    const priornodes = useRef({});
    const [portTypes, setPortTypes] = useState({});
    const [nodeTypes, setNodeTypes] = useState({});
    const myui = useRef();
    const apiCallback = useCallback(api => {
        setFlumeAPI(api);
    }, [])


    // const onChange = useCallback(nodes => {
    //     const prev = priornodes.current;
    //     const currentNodes = Object.values(nodes);

    //     // Some top level functions of truthy existance
    //     const uiCreatedNode = (n) => typeof (n.type) === 'string' && n.type.startsWith("PRE:") && !n.marked;
    //     const nodeExistedBefore = n => prev[n.id];
    //     const nodeMoved = n => prev[n.id] && (prev[n.id].x !== n.x || prev[n.id].y !== n.y);

    //     //      console.log("onChange");
    //     //        console.log(nodes)
    //     // Look for nodes that start with PRE: which indicate a new creation request
    //     const newNodes = currentNodes
    //         .filter(uiCreatedNode);

    //     // for (const n of newNodes) {
    //     //     n.marked = true;
    //     //     console.log("CREATED")
    //     //     myui.current.onCreateRequest(n.type.substring(4), n.x, n.y, n.id);
    //     // }

    //     // Nodes that are common between the current and previous state
    //     const commonNodes = currentNodes
    //         .filter(nodeExistedBefore)
    //         .filter(n => !uiCreatedNode(n));

    //     // Look for nodes that have a different position than the previous ones
    //     const movedNodes = commonNodes
    //         .filter(nodeMoved);
    //     for (const n of movedNodes) {
    //         myui.current.onNodeMoved(n.id, n.x, n.y);
    //     }

    //     // Look for nodes that have been removed
    //     const nodeDoesNotExistNow = (n) => !nodes[n.id];
    //     const deletedNodes = Object.values(priornodes.current)
    //         .filter(nodeDoesNotExistNow)
    //         .filter(n => !n.marked);

    //     for (const n of deletedNodes) {
    //         myui.current.onNodeRemoved(n.id);
    //     }

    //     priornodes.current = nodes;
    // }, []);

    useEffect(() => {
        if (!flumeapi) { return; }

        const asyncrun = async () => {

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

            // Create a controller and then subscribe to the graph changes
            const remote = IVEInterface(http_get, http_post);

            // Get the types and setup our types in the UI
            var types = await remote.getTypes();
            const config = new FlumeConfig();
            // foreach type 
            for (const t of types) {
                config.addNodeType({
                    type: "PRE:" + t,
                    label: t,
                    deletable: false
                });
            }
            config.addNodeType({
                type: "dummytype",
                label: "DUMMY",
                addable: false,
            })
            setNodeTypes(config.nodeTypes);

            const manip = await IVEManip(localStorage, remote);
            const controller = await IVEController(manip);

            controller.init(createNode);

            setUIEvents({
                addNodeRequest: async (type, x, y, id) => {
                    var node = await controller.createRequest(type.substring(4), x, y, createNode);
                    console.log(node);
//                    controller.addNode(type, x, y, id);
                },
                onNodeMoved: (id, x, y) => {
                },
            })

        };
        asyncrun();

        const createNode = (id, kind, xy, inputs, outputs) => {
            function mapPort(p) {
                return {
                    ...p,
                    name: p.Kind,
                    label: p.Kind,
                    extraProperties: {
                        "data-port-color": p.color
                    }
                }
            }

            var type = {
                type: kind,
                label: kind,
                inputs: inputs.map(mapPort),
                outputs: outputs.map(mapPort)
            }
            var newnode = {
                id: id,
                title: kind,
                x: xy[0],
                y: xy[1],
                nodeType: "dummytype"
            }
            flumeapi.addNode(newnode)
            flumeapi.updateType(newnode.id, type);
        }


        // Create a UI object for the controller.
        var ui = {

            // removeNode: id => {
            //     console.log("removing node: " + id);
            //     flumeapi.removeNode(id);
            // },
            // connect: (fromid, fromport, toid, toport) => {
            //     flumeapi.addConnection(fromid, fromport, toid, toport);
            // },
            // disconnect: (fromid, fromport, toid, toport) => {
            //     flumeapi.removeConnection(fromid, fromport, toid, toport);
            // },
            // selectNode: id => {
            //     // Color the node yellow
            //     flumeapi.updateProperties(id, { "data-node-selected": "true" });
            // },
            // deselectNode: id => {
            //     if (priornodes.current[id]) {
            //         flumeapi.updateProperties(id, {});
            //     }
            // }

        }
        //   myui.current = ui;

        //  IVEController(ui);
    }, [flumeapi])

    const nodeClicked = (id, e) => {
        myui.current.onNodeClicked(id);
    }

    const portClicked = ({ name, nodeId, isInput }) => {
        console.log("PORTCLICKED");
    }

    const portConnectRequest = (fromid, fromport, toid, toport) => {
        // Forward this on to the controller
        myui.current.onPortConnectRequest(fromid, fromport, toid, toport);
    }

    const portDisconnectRequest = (fromid, fromport, toid, toport) => {
        myui.current.onPortDisconnectRequest(fromid, fromport, toid, toport);
    }

    const addNodeRequest = (type, x, y) => {
        myui.current.onCreateRequest(type.substring(4), x, y);
    }
    const stageClicked = () => {
        myui.current.onStageClick();
    }

    const [uiEvents, setUIEvents] = useState({});
    //  useRef({
    //     nodeClicked: nodeClicked,
    //     portClicked: portClicked,
    //     portConnectRequest: portConnectRequest,
    //     portDisconnectRequest: portDisconnectRequest,
    //     addNodeRequest: addNodeRequest,
    //     onStageClick: stageClicked,
    // })

    return (
        <NodeEditor
            //onChange={onChange}
            apiCallback={apiCallback}
            uiEvents={uiEvents}
            portTypes={portTypes}
            nodeTypes={nodeTypes} />
    );
}

function IVEApp() {
    const api = useRef({});
    const [portTypes, setPortTypes] = useState(config.portTypes);
    const [nodeTypes, setNodeTypes] = useState(config.nodeTypes);
    const mynodes = useRef({});
    const priorselection = useRef(null);
    const inputPortSelected = useRef({});
    const myNodeTypes = useRef({});

    const typeOfNode = (id) => {
        var node = mynodes.current[id];
        if (!node) {
            throw new Error("Node not found");
        }
        var t = node.Kind;
        if (typeof (t) !== "string") {
            return t;
        } else {
            return myNodeTypes.current[t];
        }
    }

    const setPropertyForPort = (ports, name, properties) => {
        return ports.map(p => p.name === name ? { ...p, extraProperties: properties } : p);
    }

    const setInputPortProperties = (id, name, properties) => {
        var t = { ...typeOfNode(id) };
        t.inputs = setPropertyForPort(t.inputs, name, properties);
        api.current.updateType(id, t);
    }

    const nodeClicked = (id, e) => {
        if (priorselection.current) {
            api.current.updateProperties(priorselection.current, {});
        }
        api.current.updateProperties(id, { "data-node-selected": "true" });
        priorselection.current = id;
    }

    const portClicked = ({ name, nodeId, isInput }) => {
        var thisselected = { name, nodeId };
        if (isInput) {
            if (inputPortSelected.current.nodeId) {
                setInputPortProperties(inputPortSelected.current.nodeId, inputPortSelected.current.name, {});
            }
            inputPortSelected.current = thisselected;
            setInputPortProperties(nodeId, name, { "data-port-selected": "true" });
        }
        console.log("portClicked", name, nodeId, isInput);
    }

    const portConnectRequest = (fromid, fromport, toid, toport) => {
        console.log("port connect request")
    }

    const uiEvents = useRef({
        nodeClicked: nodeClicked,
        portClicked: portClicked,
        portConnectRequest: portConnectRequest
    })

    function inputProperties(nodeId, name) {
        if (inputPortSelected.current.nodeId === nodeId && inputPortSelected.current.name === name) {
            console.log("Setting properties for input port", nodeId, name)
            return {
                "data-port-selected": "true"
            }
        } else {
            return null;
        }
    }

    const onNewTypeDescriptions = (types) => {
        // types is an array, get the Kind field of each
        const typekinds = types.map(t => t.Kind);
        const config = new FlumeConfig()
        config.addPortType({
            type: "boolean",
            name: "boolean"
        });
        types.forEach(t => {
            const kind = t.Kind;
            const inputs = t.Inputs;
            const outputs = t.Outputs;

            // inputs where the Name is not in the list of types
            inputs.filter(p => !(config.portTypes.hasOwnProperty(p.Type.Name))).forEach(p => {
                config.addPortType({
                    type: p.Type.Name,
                    name: p.Type.Name,
                    color: Colors.blue,
                    label: "ZZZZ"
                })
            })
            outputs.filter(p => !(config.portTypes.hasOwnProperty(p.Type.Name))).forEach(p => {
                config.addPortType({
                    type: p.Type.Name,
                    name: p.Type.Name,
                    color: Colors.blue,
                    label: "ZZZZ"
                })
            })

            // config.addNodeType({
            //     type: ('PRE:' + kind),
            //     label: kind
            // });
            config.addNodeType({
                type: kind,
                label: kind,
                //                visible: false,
                inputs: ports => inputs.map(i => ports[i.Type.Name]({ name: i.Name, label: i.Name })),
                outputs: ports => outputs.map(o => ports[o.Type.Name]({ name: o.Name, label: o.Name })),
            })
        });
        setPortTypes(config.portTypes);
        console.log("SEtting node types")
        setNodeTypes(config.nodeTypes);
        myNodeTypes.current = config.nodeTypes;
        console.log("Set node types")
    }

    useEffect(() => {
        console.log("Building remote interface")
        RemoteInterface({
            newTypeDescriptions: onNewTypeDescriptions
        })
    }, [])

    const onChange = nodes => {
        mynodes.current = { ...nodes };
        // 
        // var nodes_with_string_type = Object.values(nodes).filter(n => typeof (n.type) === "string");
        // for (let n of nodes_with_string_type) {
        //     var t = nodeTypes[n.type];
        //     delete n.width;
        //     console.log(t);
        //     // unfold this type into the node itself.
        //     var newinputs = t.inputs.map(content => ({ ...content }));
        //     var newoutputs = t.outputs.map(content => ({ ...content }));
        //     var newtype = {
        //         ...t,
        //         inputs: newinputs,
        //         outputs: newoutputs
        //     }
        //     api.current.updateType(n.id, newtype);
        // }
    };

    function apiCallback(a) {
        api.current = a;
    }

    // Quick little hack to implement the API
    // after the first render
    useLayoutEffect(() => {
        if (api.current.dispatchNodes) {
            api.current = CreateAPI(api.current.dispatchNodes, api.current.dispatchToasts);
        }
    }, [api])

    return (
        <div style={{ width: 1600, height: 900 }}>
            <NodeEditor api={api.current}
                onChange={onChange}
                uiEvents={uiEvents}
                apiCallback={apiCallback}
                portTypes={portTypes}
                nodeTypes={nodeTypes} />
        </div>

    )
}

export { IVEApp, Top }
