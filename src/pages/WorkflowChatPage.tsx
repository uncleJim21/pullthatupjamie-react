import React from 'react';
import { AudioControllerProvider } from '../context/AudioControllerContext.tsx';
import { WorkflowChat } from '../components/workflow/WorkflowChat.tsx';

const WorkflowChatPage: React.FC = () => (
  <AudioControllerProvider>
    <div className="h-screen bg-black">
      <WorkflowChat />
    </div>
  </AudioControllerProvider>
);

export default WorkflowChatPage;
