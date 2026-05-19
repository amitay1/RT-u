import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { 
  Key, 
  Building2, 
  Monitor, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LicenseActivation {
  id: string;
  machineName: string;
  machineId: string;
  appVersion: string;
  activatedAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

interface License {
  id: string;
  licenseKey: string;
  factoryId: string;
  factoryName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  purchasedStandards: string[];
  maxActivations: number;
  isLifetime: boolean;
  expiryDate: string | null;
  totalPrice: string;
  notes: string | null;
  status: string;
  createdAt: string;
  activationCount: number;
  activeCount: number;
  activations: LicenseActivation[];
}

interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  totalActivations: number;
  activeActivations: number;
  recentActivations: any[];
}

const AVAILABLE_STANDARDS = {
  'AMS': { code: 'AMS-STD-2154E', name: 'Aerospace Material Specification', price: 500 },
  'AMS2630': { code: 'AMS-2630', name: 'AMS 2630 Product Over 0.5 Inch Thick', price: 500 },
  'ASTM': { code: 'ASTM-A388', name: 'Steel Forgings', price: 500 },
  'ASTM_E1001': { code: 'ASTM-E1001', name: 'Immersion Pulse-Echo UT', price: 500 },
  'ASTM_E2580': { code: 'ASTM-E2580', name: 'Composite Panel UT', price: 500 },
  'ASTM_E588': { code: 'ASTM-E588', name: 'Bearing Steel Cleanliness', price: 500 },
  'BS3': { code: 'BS-EN-10228-3', name: 'European Steel Standards Part 3', price: 500 },
  'BS4': { code: 'BS-EN-10228-4', name: 'European Steel Standards Part 4', price: 500 },
  'MIL': { code: 'MIL-STD-2154', name: 'Military Standard', price: 800 },
};

export default function LicenseDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    factoryName: "",
    contactEmail: "",
    contactPhone: "",
    standards: ["AMS", "AMS2630", "ASTM", "ASTM_E1001", "ASTM_E2580", "ASTM_E588", "BS3", "BS4", "MIL"],
    isLifetime: true,
    expiryDate: "",
    maxActivations: 3,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [licensesRes, statsRes] = await Promise.all([
        fetch("/api/licenses"),
        fetch("/api/licenses/stats"),
      ]);

      if (licensesRes.ok) {
        const data = await licensesRes.json();
        setLicenses(data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch license data:", error);
      toast({
        title: "Error",
        description: "Failed to load license data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLicense = async () => {
    if (!formData.factoryName) {
      toast({
        title: "Error",
        description: "Factory name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.standards.length === 0) {
      toast({
        title: "Error",
        description: "Select at least one standard",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create license");
      }

      const license = await res.json();
      setNewLicenseKey(license.licenseKey);
      
      toast({
        title: "License Created!",
        description: `License for ${formData.factoryName} has been generated`,
      });

      // Reset form and refresh
      setFormData({
        factoryName: "",
        contactEmail: "",
        contactPhone: "",
        standards: ["AMS", "ASTM", "BS3", "BS4", "MIL"],
        isLifetime: true,
        expiryDate: "",
        maxActivations: 3,
        notes: "",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied!",
      description: "License key copied to clipboard",
    });
  };

  const handleDeactivate = async (licenseId: string, activationId: string) => {
    try {
      await fetch(`/api/licenses/${licenseId}/activations/${activationId}`, {
        method: "DELETE",
      });
      
      toast({
        title: "Deactivated",
        description: "Machine has been deactivated",
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate machine",
        variant: "destructive",
      });
    }
  };

  const handleRevokeLicense = async (licenseId: string) => {
    if (!confirm("Are you sure you want to revoke this license?")) return;

    try {
      await fetch(`/api/licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      
      toast({
        title: "Revoked",
        description: "License has been revoked",
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke license",
        variant: "destructive",
      });
    }
  };

  const calculatePrice = () => {
    return formData.standards.reduce((sum, key) => {
      return sum + (AVAILABLE_STANDARDS[key as keyof typeof AVAILABLE_STANDARDS]?.price || 0);
    }, 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to App
            </Button>
            <div>
              <h1 className="text-3xl font-bold">License Dashboard</h1>
              <p className="text-muted-foreground">Manage desktop licenses and activations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create License
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New License</DialogTitle>
                  <DialogDescription>
                    Generate a new license key for a factory
                  </DialogDescription>
                </DialogHeader>
                
                {newLicenseKey ? (
                  <div className="space-y-4 py-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-green-700 dark:text-green-300">License Created Successfully!</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Copy this license key and send it to the customer:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background p-3 rounded border text-sm font-mono break-all">
                          {newLicenseKey}
                        </code>
                        <Button size="icon" onClick={() => handleCopyKey(newLicenseKey)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => {
                        setNewLicenseKey(null);
                        setCreateDialogOpen(false);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="factoryName">Factory Name *</Label>
                        <Input
                          id="factoryName"
                          value={formData.factoryName}
                          onChange={(e) => setFormData({ ...formData, factoryName: e.target.value })}
                          placeholder="Acme Manufacturing"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxActivations">Max Activations</Label>
                        <Input
                          id="maxActivations"
                          type="number"
                          value={formData.maxActivations}
                          onChange={(e) => setFormData({ ...formData, maxActivations: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">Contact Email</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={formData.contactEmail}
                          onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                          placeholder="contact@factory.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactPhone">Contact Phone</Label>
                        <Input
                          id="contactPhone"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          placeholder="+1-555-123-4567"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Standards</Label>
                      <div className="grid grid-cols-2 gap-2 border rounded-lg p-3">
                        {Object.entries(AVAILABLE_STANDARDS).map(([key, std]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={formData.standards.includes(key)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({ ...formData, standards: [...formData.standards, key] });
                                } else {
                                  setFormData({ ...formData, standards: formData.standards.filter(s => s !== key) });
                                }
                              }}
                            />
                            <label htmlFor={key} className="text-sm cursor-pointer">
                              {std.code} (${std.price})
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Total: <strong>${calculatePrice()}</strong>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isLifetime"
                        checked={formData.isLifetime}
                        onCheckedChange={(checked) => setFormData({ ...formData, isLifetime: !!checked })}
                      />
                      <label htmlFor="isLifetime" className="text-sm cursor-pointer">
                        Lifetime License (no expiry)
                      </label>
                    </div>

                    {!formData.isLifetime && (
                      <div className="space-y-2">
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input
                          id="expiryDate"
                          type="date"
                          value={formData.expiryDate}
                          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (internal)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Any internal notes about this license..."
                      />
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateLicense}>
                        Generate License
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalLicenses || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeLicenses || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Activations</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalActivations || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeActivations || 0} active machines
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Factories</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeLicenses || 0}</div>
              <p className="text-xs text-muted-foreground">
                Using ScanMaster
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.recentActivations?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Activations this week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Licenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Licenses</CardTitle>
            <CardDescription>
              Manage your desktop application licenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : licenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No licenses created yet</p>
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  Create Your First License
                </Button>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {licenses.map((license) => (
                  <AccordionItem key={license.id} value={license.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-semibold">{license.factoryName}</div>
                            <div className="text-sm text-muted-foreground">{license.factoryId}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {license.activeCount}/{license.maxActivations} activations
                          </div>
                          {getStatusBadge(license.status)}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-9 space-y-4">
                        {/* License Key */}
                        <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                          <code className="flex-1 text-sm font-mono">{license.licenseKey}</code>
                          <Button size="sm" variant="outline" onClick={() => handleCopyKey(license.licenseKey)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Standards</div>
                            <div className="font-medium">{(license.purchasedStandards || []).join(", ")}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Expiry</div>
                            <div className="font-medium">
                              {license.isLifetime ? "Lifetime" : (license.expiryDate ? formatDate(license.expiryDate) : "N/A")}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Created</div>
                            <div className="font-medium">{formatDate(license.createdAt)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Price</div>
                            <div className="font-medium">${license.totalPrice}</div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        {(license.contactEmail || license.contactPhone) && (
                          <div className="text-sm">
                            <div className="text-muted-foreground">Contact</div>
                            <div>{license.contactEmail} {license.contactPhone && `| ${license.contactPhone}`}</div>
                          </div>
                        )}

                        {/* Notes */}
                        {license.notes && (
                          <div className="text-sm">
                            <div className="text-muted-foreground">Notes</div>
                            <div>{license.notes}</div>
                          </div>
                        )}

                        {/* Activations */}
                        {license.activations.length > 0 && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-2">Active Machines</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Machine</TableHead>
                                  <TableHead>Version</TableHead>
                                  <TableHead>Activated</TableHead>
                                  <TableHead>Last Seen</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {license.activations.map((activation) => (
                                  <TableRow key={activation.id}>
                                    <TableCell>
                                      <div className="font-medium">{activation.machineName}</div>
                                      <div className="text-xs text-muted-foreground">{activation.machineId.substring(0, 20)}...</div>
                                    </TableCell>
                                    <TableCell>{activation.appVersion || "N/A"}</TableCell>
                                    <TableCell>{formatDate(activation.activatedAt)}</TableCell>
                                    <TableCell>{formatDate(activation.lastSeenAt)}</TableCell>
                                    <TableCell>
                                      {activation.isActive ? (
                                        <Badge className="bg-green-500">Active</Badge>
                                      ) : (
                                        <Badge variant="secondary">Inactive</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {activation.isActive && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDeactivate(license.id, activation.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {license.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeLicense(license.id)}
                            >
                              Revoke License
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
