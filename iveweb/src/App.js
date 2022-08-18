import { NodeEditor } from "flume";
import { FlumeConfig } from 'flume'
import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { http_get, http_post } from './HTTPGetPost'
import { IVEController } from "./IVEController";
import { IVEInterface } from "./IVEInterface_remote";
import IVEManip from "./IVEManip";
import ReceiveTest from "./ReceiveTest";

import { Colors } from 'flume';
import InspectorTap from "./InspectorTap";
const colors = {
  'Double': Colors.blue,
  'Int32': Colors.green,
  'String': Colors.red,
  'Boolean': Colors.orange,
};


const ToFlumePort = port => ({
  name: port.Name,
  label: port.Name,
  color: colors[port.Kind]
})

const ToFlumeType = node => ({
  type: "custom",
  label: node.Kind,
  description: "NO DESCRIPTION",
  inputs: node.Inputs.map(ToFlumePort),
  outputs: node.Outputs.map(ToFlumePort),
  initialWidth: 100
})

const FlumeAPIToControllerAPI = api => {
  return {
    addNode: node => api.addNode({
      id: node.Id,
      nodeType: ToFlumeType(node),
      inputData: true,
      x: node.x,
      y: node.y
    }),
    removeNode: id => api.removeNode(id),
    connect: (fromid, fromport, toid, toport) => api.addConnection(fromid, fromport, toid, toport),
    disconnect: (fromid, fromport, toid, toport) => api.removeConnection(fromid, fromport, toid, toport),
    selectNode: id => api.updateProperties(id, { "data-node-selected": "true" }),
    deselectNode: id => api.updateProperties(id, { "data-node-selected": "false" })
  }
}

function App() {
  const [nodetypes, setNodeTypes] = useState([]);
  const [uiEvents, setUIEvents] = useState([]);
  const [inspector, setInspector] = useState([]);
  const [tap, setTap] = useState(null);

  const apiCallback = useCallback(async api => {
    console.log("in APICallback")
    // Create a controller and then subscribe to the graph changes
    const downstream_remote = IVEInterface(http_get, http_post);

    // Create a tap for setting the graph
    // This is wonky way to patch the setting of a graph
    const tap = await InspectorTap(downstream_remote.setGraph);
    setTap(tap);
    const remote = {
      getTypes: downstream_remote.getTypes,
      getTypeInfo: downstream_remote.getTypeInfo,
      setGraph: tap.setGraph
    }

    // Get the types and setup our types in the UI
    var types = await remote.getTypes();
    const config = new FlumeConfig();
    // foreach type 
    for (const t of types) {
      config.addNodeType({
        type: t,
        label: t,
        deletable: false
      });
    }
    setNodeTypes(config.nodeTypes);

    const inspectorapi = {
      show: nodes => setInspector(nodes)
    }

    // Create a manipulator and controller
    const manip = await IVEManip(localStorage, remote);
    const controller = await IVEController(FlumeAPIToControllerAPI(api), manip, inspectorapi);

    // Bind our uievents into the controller
    const uiEvents = {
      addNodeRequest: (type, x, y) => controller.createRequest(type, x, y),
      deleteNodeRequest: id => controller.removeRequest(id),
      portConnectRequest: (fromid, fromport, toid, toport) => controller.portConnectRequest(fromid, fromport, toid, toport),
      portDisconnectRequest: (fromid, fromport, toid, toport) => controller.portDisconnectRequest(fromid, fromport, toid, toport),
      nodeClicked: id => controller.nodeClicked(id),
      nodeMoved: (id, x, y) => controller.nodeMoved(id, x, y),
      stageClicked: () => controller.stageClicked()
    }
    setUIEvents(uiEvents);

    return () => {
      tap.dispose();
    }
  }, [])

  return (
    <div className="App">
      <div style={{ width: '100%', height: 900 }}>
        <NodeEditor
          nodeTypes={nodetypes}
          apiCallback={apiCallback}
          uiEvents={uiEvents}
        />
      </div>
      {tap ? <Inspector tap={tap} nodes={inspector}/> : null}
      <ReceiveTest />
    </div>
  );
}

const Port = (p) => (
    <div key={p.Name}>{p.Name} - {p.Kind}</div>
  )

const ShowNode = ({ node,tap }) => {
  useEffect(() => {
    const sub = tap.tap(node.Id, data => {
      console.log("Got data from tap for node", node.Id, data);
    })
    return sub;
  },[node,tap])
  return (
    <div>
      <div>{node.Kind}</div>
      <h2>Inputs</h2>
      <div>{node.Inputs.map(Port)}</div>
      <h2>Outputs</h2>
      <div>{node.Outputs.map(Port)}</div>
    </div>
  )
}

const Inspector = ({ nodes, tap }) => {
  return (
    <div className='inspector' style={{ minWidth: 200, minHeight: 200, position: 'absolute', left: 0, top: 0, border: '1px solid gray' }}>
    <h1>Inspector</h1>
    {nodes.map(node => (<ShowNode key={node.Id} tap={tap} node={node} />))}
  </div>
  )
}

export default App;
