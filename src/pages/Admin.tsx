import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface UserRole {
  role: string;
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      setProfiles(profilesData);

      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

      const rolesMap: Record<string, string> = {};
      rolesData?.forEach((r: any) => {
        rolesMap[r.user_id] = r.role;
      });

      setUserRoles(rolesMap);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, currentRole: string) => {
    try {
      if (currentRole === "admin") {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Admin role removed");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Admin role granted");
      }

      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling admin:", error);
      toast.error(error.message);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="text-center py-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage users and system configuration</p>
        </div>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-mono text-sm">{profile.email}</TableCell>
                        <TableCell>{profile.full_name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={userRoles[profile.id] === "admin" ? "default" : "secondary"}
                          >
                            {userRoles[profile.id] || "user"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(profile.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAdmin(profile.id, userRoles[profile.id] || "user")}
                          >
                            {userRoles[profile.id] === "admin" ? "Remove Admin" : "Make Admin"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
