import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useI18n } from "@/lib/i18n"

interface TokenLog {
  id: number
  created_at: string
  api_key_id?: number
  user_channel_id?: number
  channel_id: number
  model_name: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number
  cost: string | number
}

export default function Logs() {
  const { t } = useI18n()

  const { data: logs = [], isLoading } = useQuery<TokenLog[]>({
    queryKey: ["logs", "user"],
    queryFn: async () => {
      const res = await api.get("/user/logs")
      return res.data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("usage.title")}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{t("usage.userSubtitle")}</div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.time")}</TableHead>
              <TableHead>{t("usage.apiKey")}</TableHead>
              <TableHead>{t("usage.userChannel")}</TableHead>
              <TableHead>{t("usage.upstreamChannel")}</TableHead>
              <TableHead>{t("common.model")}</TableHead>
              <TableHead>{t("common.tokens")}</TableHead>
              <TableHead>{t("usage.cachedInput")}</TableHead>
              <TableHead>{t("common.cost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("usage.noUsage")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell>{log.api_key_id || "-"}</TableCell>
                  <TableCell>{log.user_channel_id || "-"}</TableCell>
                  <TableCell>{log.channel_id}</TableCell>
                  <TableCell>{log.model_name}</TableCell>
                  <TableCell>
                    {log.input_tokens} / {log.output_tokens}
                  </TableCell>
                  <TableCell>{log.cached_input_tokens || 0}</TableCell>
                  <TableCell>${log.cost}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
