import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { FeatureFormData } from './use-feature-form-data';

/**
 * Props for RBACConfiguration component.
 */
interface RBACConfigurationProps {
  formData: FeatureFormData;
  onUpdateFormData: (_field: string, _value: boolean) => void;
  onUpdateRBACRole: (_role: string, _field: string, _value: boolean | string) => void;
}

/**
 * Component for configuring Role-Based Access Control (RBAC) settings.
 * @param root0 - Component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @param root0.onUpdateRBACRole - Function to update RBAC role settings.
 * @returns JSX element for the RBAC configuration.
 */
/**
 * RBACConfiguration function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @param root0.onUpdateRBACRole
 * @returns Function result.
 */
export function RBACConfiguration({
  formData,
  onUpdateFormData,
  onUpdateRBACRole,
}: RBACConfigurationProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Role-Based Access Control (RBAC)</h3>
      
      <div className="flex items-center gap-3">
        <Label htmlFor="rbacRequired" className="text-sm font-medium">
          Does this feature require RBAC?
        </Label>
        <Switch
          id="rbacRequired"
          checked={formData.rbacRequired}
          onCheckedChange={(checked: boolean) => onUpdateFormData('rbacRequired', checked)}
        />
        <span className="text-xs text-gray-500">
          Enable role-based access control for this feature
        </span>
      </div>

      {formData.rbacRequired && (
        <div className="bg-yellow-50 p-4 rounded-lg space-y-4">
          <h4 className="font-medium text-yellow-800">Configure Role Permissions</h4>
          <p className="text-sm text-yellow-700">
            For each role, specify read/write permissions and organizational limitations.
          </p>
          
          {Object.entries(formData.rbacRoles).map(([role, permissions]) => (
            <div key={role} className="bg-white p-3 rounded border">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium capitalize text-gray-900">
                  {role.replace('_', ' ')}
                </h5>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${role}-read`}
                    checked={permissions.read}
                    onChange={(e) => {
                      onUpdateRBACRole(role, 'read', e.target.checked);
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`${role}-read`} className="text-sm">
                    Read Access
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${role}-write`}
                    checked={permissions.write}
                    onChange={(e) => {
                      onUpdateRBACRole(role, 'write', e.target.checked);
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`${role}-write`} className="text-sm">
                    Write Access
                  </Label>
                </div>
                
                <div>
                  <Label htmlFor={`${role}-limitation`} className="text-sm">
                    Org. Limitation
                  </Label>
                  <Input
                    id={`${role}-limitation`}
                    placeholder="e.g., own building only"
                    value={permissions.organizationalLimitation}
                    onChange={(e) => {
                      onUpdateRBACRole(role, 'organizationalLimitation', e.target.value);
                    }}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}