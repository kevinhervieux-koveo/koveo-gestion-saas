import React from 'react';
import type { UserWithAssignments } from '@shared/schema';

interface UserAssignmentsTableProps {
  users: UserWithAssignments[];
  isLoading: boolean;
  onEditUser?: (user: UserWithAssignments) => void;
  onEditOrganizations?: (user: UserWithAssignments) => void;
  onEditResidences?: (user: UserWithAssignments) => void;
  onDeleteUser?: (user: UserWithAssignments) => void;
  canEditOrganizations?: boolean;
  canEditResidences?: boolean;
  canDeleteUsers?: boolean;
}

export function UserAssignmentsTable({ 
  users, 
  isLoading, 
  onEditUser,
  onEditOrganizations,
  onEditResidences,
  onDeleteUser,
  canEditOrganizations = false,
  canEditResidences = false,
  canDeleteUsers = false
}: UserAssignmentsTableProps) {

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8" data-testid="loading-users">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="no-users">
        No users found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300" data-testid="users-table">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-name">
              Name
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-email">
              Email
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-role">
              Role
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-status">
              Status
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-organizations">
              Organizations
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-buildings">
              Buildings
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-residences">
              Residences
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left" data-testid="header-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50" data-testid={`user-row-${user.id}`}>
              {/* Name */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`name-${user.id}`}>
                {user.firstName} {user.lastName}
              </td>
              
              {/* Email */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`email-${user.id}`}>
                {user.email}
              </td>
              
              {/* Role */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`role-${user.id}`}>
                <span className={`px-2 py-1 rounded text-xs ${
                  user.role === 'admin' 
                    ? 'bg-red-100 text-red-800'
                    : user.role === 'manager'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {user.role}
                </span>
              </td>
              
              {/* Status */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`status-${user.id}`}>
                <span className={`px-2 py-1 rounded text-xs ${
                  user.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              
              {/* Organizations */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`organizations-${user.id}`}>
                <div className="space-y-1">
                  {Array.isArray(user.organizations) && user.organizations.length > 0 ? (
                    user.organizations.map((org, idx) => (
                      <div
                        key={org.id || idx}
                        className="text-xs bg-blue-50 px-2 py-1 rounded"
                        data-testid={`org-${user.id}-${idx}`}
                      >
                        {org.name}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-xs" data-testid={`no-orgs-${user.id}`}>
                      No organizations
                    </div>
                  )}
                </div>
              </td>
              
              {/* Buildings */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`buildings-${user.id}`}>
                <div className="space-y-1">
                  {Array.isArray(user.buildings) && user.buildings.length > 0 ? (
                    user.buildings.slice(0, 3).map((building, idx) => (
                      <div
                        key={building.id || idx}
                        className="text-xs bg-purple-50 px-2 py-1 rounded"
                        data-testid={`building-${user.id}-${idx}`}
                      >
                        {building.name}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-xs" data-testid={`no-buildings-${user.id}`}>
                      No buildings
                    </div>
                  )}
                  {Array.isArray(user.buildings) && user.buildings.length > 3 && (
                    <div className="text-xs text-gray-500" data-testid={`more-buildings-${user.id}`}>
                      +{user.buildings.length - 3} more
                    </div>
                  )}
                </div>
              </td>
              
              {/* Residences */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`residences-${user.id}`}>
                <div className="space-y-1">
                  {Array.isArray(user.residences) && user.residences.length > 0 ? (
                    user.residences.slice(0, 3).map((residence, idx) => (
                      <div
                        key={residence.id || idx}
                        className="text-xs bg-yellow-50 px-2 py-1 rounded"
                        data-testid={`residence-${user.id}-${idx}`}
                      >
                        Unit {residence.unitNumber}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-xs" data-testid={`no-residences-${user.id}`}>
                      No residences
                    </div>
                  )}
                  {Array.isArray(user.residences) && user.residences.length > 3 && (
                    <div className="text-xs text-gray-500" data-testid={`more-residences-${user.id}`}>
                      +{user.residences.length - 3} more
                    </div>
                  )}
                </div>
              </td>
              
              {/* Actions */}
              <td className="border border-gray-300 px-4 py-2" data-testid={`actions-${user.id}`}>
                <div className="flex gap-2 flex-wrap">
                  {onEditUser && (
                    <button
                      onClick={() => onEditUser(user)}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      data-testid={`edit-user-${user.id}`}
                    >
                      Edit User
                    </button>
                  )}
                  
                  {canEditOrganizations && onEditOrganizations && (
                    <button
                      onClick={() => onEditOrganizations(user)}
                      className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                      data-testid={`edit-orgs-${user.id}`}
                    >
                      Organizations
                    </button>
                  )}
                  
                  {canEditResidences && onEditResidences && (
                    <button
                      onClick={() => onEditResidences(user)}
                      className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                      data-testid={`edit-residences-${user.id}`}
                    >
                      Residences
                    </button>
                  )}
                  
                  {canDeleteUsers && onDeleteUser && (
                    <button
                      onClick={() => onDeleteUser(user)}
                      className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                      data-testid={`delete-user-${user.id}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}