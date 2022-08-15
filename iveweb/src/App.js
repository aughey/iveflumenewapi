import { NodeEditor } from "flume";
import { FlumeConfig } from 'flume'
import { useCallback, useState } from 'react';
import './App.css';
import { http_get, http_post } from './HTTPGetPost'
import { IVEController } from "./IVEController";
import { IVEInterface } from "./IVEInterface_remote";
import IVEManip from "./IVEManip";

import { Colors } from 'flume';
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

  const apiCallback = useCallback(async api => {
    console.log("in APICallback")
    // Create a controller and then subscribe to the graph changes
    const remote = IVEInterface(http_get, http_post);
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

    // Create a manipulator and controller
    const manip = await IVEManip(localStorage, remote);
    const controller = await IVEController(FlumeAPIToControllerAPI(api), manip);

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
  }, [])

  return (
    <div className="App">
      <div style={{ width: 1600, height: 900 }}>
        <NodeEditor
          nodeTypes={nodetypes}
          apiCallback={apiCallback}
          uiEvents={uiEvents}
        />
      </div>

    </div>
  );
}

export default App;
