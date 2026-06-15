import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Edit, Trash } from "lucide-react"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface Group {
  id: number
  name: string
}

interface UserGroupMembership {
  group?: Group
  expires_at?: string | null
}

interface User {
  id: number
  username: string
  email: string
  group_id?: number
  group?: Group
  groups?: UserGroupMembership[]
  balance: string | number
  is_admin: boolean
}

interface UserDraft {
  id: number
  username: string
  email: string
  balance: string
  group_id: string
  is_admin: boolean
}

export default function Users() {
  const { language, t } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const queryClient = useQueryClient()
  const [editingUser, setEditingUser] = useState<UserDraft | null>(null)
  const [status, setStatus] = useState("")

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await api.get("/groups")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const updateUser = useMutation({
    mutationFn: async (draft: UserDraft) => {
      const res = await api.put(`/users/${draft.id}`, {
        balance: Number(draft.balance || 0),
        group_id: Number(draft.group_id || 0),
        is_admin: draft.is_admin,
      })
      return res.data
    },
    onSuccess: () => {
      setEditingUser(null)
      setStatus(copy.saved)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["me"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
    },
    onError: () => setStatus(copy.saveFailed),
  })

  const deleteUser = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      setStatus(copy.deleted)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
    },
    onError: () => setStatus(copy.deleteFailed),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("users.title")}</h1>
        {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.username")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.group")}</TableHead>
              <TableHead>{t("common.balance")}</TableHead>
              <TableHead>{t("common.admin")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("users.noUsers")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{groupNames(user)}</TableCell>
                  <TableCell>${user.balance}</TableCell>
                  <TableCell>{user.is_admin ? t("common.yes") : t("common.no")}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" title={t("common.edit")} onClick={() => setEditingUser(userToDraft(user))}>
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      title={t("common.delete")}
                      disabled={deleteUser.isPending}
                      onClick={() => {
                        if (window.confirm(copy.confirmDelete.replace("{name}", user.username || user.email))) {
                          deleteUser.mutate(user.id)
                        }
                      }}
                    >
                      <Trash size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.editUser}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("common.username")}</span>
                <Input value={editingUser.username} disabled />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("common.email")}</span>
                <Input value={editingUser.email} disabled />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("common.balance")}</span>
                <Input
                  type="number"
                  step="0.000001"
                  value={editingUser.balance}
                  onChange={(event) => setEditingUser({ ...editingUser, balance: event.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{copy.primaryGroup}</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={editingUser.group_id}
                  onChange={(event) => setEditingUser({ ...editingUser, group_id: event.target.value })}
                >
                  <option value="">{copy.selectGroup}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingUser.is_admin}
                  onChange={(event) => setEditingUser({ ...editingUser, is_admin: event.target.checked })}
                />
                <span>{copy.adminPermission}</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>{t("common.cancel")}</Button>
            <Button disabled={!editingUser?.group_id || updateUser.isPending} onClick={() => editingUser && updateUser.mutate(editingUser)}>
              {updateUser.isPending ? copy.saving : copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function groupNames(user: User) {
  const names = activeGroupMemberships(user)
    .map((membership) => membership.group?.name)
    .filter((name): name is string => Boolean(name))
  if (names.length > 0) {
    return names.join(", ")
  }
  return user.group?.name || "-"
}

function userToDraft(user: User): UserDraft {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: String(user.balance ?? 0),
    group_id: String(user.group_id || user.group?.id || activeGroupMemberships(user)[0]?.group?.id || ""),
    is_admin: user.is_admin,
  }
}

function activeGroupMemberships(user: User) {
  return (user.groups || []).filter((membership) => !membership.expires_at || new Date(membership.expires_at).getTime() > Date.now())
}

const zhCopy = {
  editUser: "编辑用户",
  primaryGroup: "主用户组",
  selectGroup: "选择用户组",
  adminPermission: "管理员权限",
  save: "保存",
  saving: "保存中...",
  saved: "用户已保存",
  saveFailed: "用户保存失败",
  deleted: "用户已删除",
  deleteFailed: "用户删除失败",
  confirmDelete: "确定删除用户 {name} 吗？",
}

const enCopy = {
  editUser: "Edit User",
  primaryGroup: "Primary group",
  selectGroup: "Select group",
  adminPermission: "Admin permission",
  save: "Save",
  saving: "Saving...",
  saved: "User saved",
  saveFailed: "Failed to save user",
  deleted: "User deleted",
  deleteFailed: "Failed to delete user",
  confirmDelete: "Delete user {name}?",
}
