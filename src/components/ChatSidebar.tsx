import { useState } from 'react';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
}

interface Group {
  _id: string;
  name: string;
  description?: string;
  members: User[];
}

interface ChatSidebarProps {
  users: User[];
  groups: Group[];
  selectedUser: User | null;
  selectedGroup: Group | null;
  onSelectUser: (user: User) => void;
  onSelectGroup: (group: Group) => void;
  onCreateGroup: (name: string, description: string, members: string[]) => Promise<void>;
  onLogout: () => void;
}

export default function ChatSidebar({
  users,
  groups,
  selectedUser,
  selectedGroup,
  onSelectUser,
  onSelectGroup,
  onCreateGroup,
  onLogout
}: ChatSidebarProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    await onCreateGroup(groupName, groupDescription, selectedMembers);
    setShowCreateGroup(false);
    setGroupName('');
    setGroupDescription('');
    setSelectedMembers([]);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold mb-4">Chats</h2>
        <button
          onClick={() => setShowCreateGroup(!showCreateGroup)}
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 mb-2"
        >
          Create Group
        </button>
        <button
          onClick={onLogout}
          className="w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {showCreateGroup && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md mb-2"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md mb-2"
          />
          <div className="mb-2">
            <p className="text-sm font-semibold mb-1">Select members:</p>
            {users.map(user => (
              <label key={user._id} className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(user._id)}
                  onChange={() => toggleMember(user._id)}
                  className="mr-2"
                />
                <span className="text-sm">{user.username}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleCreateGroup}
            className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600"
          >
            Create
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h3 className="font-semibold text-gray-700 mb-2">Groups</h3>
          {groups.map(group => (
            <div
              key={group._id}
              onClick={() => onSelectGroup(group)}
              className={`p-3 rounded-md cursor-pointer mb-2 ${
                selectedGroup?._id === group._id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
            >
              <div className="font-semibold">{group.name}</div>
              <div className="text-sm text-gray-500">{group.members.length} members</div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-2">Users</h3>
          {users.map(user => (
            <div
              key={user._id}
              onClick={() => onSelectUser(user)}
              className={`p-3 rounded-md cursor-pointer mb-2 flex items-center ${
                selectedUser?._id === user._id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{user.username}</div>
                <div className="text-xs text-gray-500 flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-1 ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  {user.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
