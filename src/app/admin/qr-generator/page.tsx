
"use client"

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RoomQRGenerator() {
  const [roomName, setRoomName] = useState('');
  const [generatedRooms, setGeneratedRooms] = useState<string[]>(['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111']);
  const { toast } = useToast();
  const canvasRefs = useRef<{[key: string]: HTMLCanvasElement | null}>({});

  const handleAddRoom = () => {
    if (!roomName.trim()) return;
    if (generatedRooms.includes(roomName.trim().toUpperCase())) {
      toast({ variant: 'destructive', title: 'Error', description: 'Room already exists.' });
      return;
    }
    setGeneratedRooms(prev => [...prev, roomName.trim().toUpperCase()]);
    setRoomName('');
    toast({ title: 'Success', description: `Room ${roomName} added to list.` });
  };

  const downloadQR = (room: string) => {
    const canvas = canvasRefs.current[room];
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${room}-QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const printQR = (room: string) => {
    const canvas = canvasRefs.current[room];
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR - ${room}</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding-top: 50px; }
              .room-name { font-size: 48px; font-weight: bold; margin-bottom: 20px; }
              img { width: 400px; height: 400px; border: 2px solid #000; padding: 10px; }
              .footer { margin-top: 20px; font-size: 24px; color: #666; }
            </style>
          </head>
          <body>
            <div class="room-name">${room}</div>
            <img src="${url}" />
            <div class="footer">Scan to Log Room Usage</div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-primary tracking-tight">Room QR Generator</h1>
        <p className="text-muted-foreground font-medium italic">Create, download, and print laboratory room identification codes.</p>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader>
          <CardTitle>Manual Room Registration</CardTitle>
          <CardDescription>Enter a room identifier to generate its specific QR code.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input 
              placeholder="e.g., M112" 
              className="h-12 border-2 rounded-xl"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button onClick={handleAddRoom} className="h-12 px-8 font-bold rounded-xl gap-2">
              <Plus className="w-5 h-5" /> Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {generatedRooms.map(room => (
          <Card key={room} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-50 shadow-inner">
                <QRCodeCanvas 
                  ref={(el) => { canvasRefs.current[room] = el; }}
                  value={JSON.stringify({ room })} 
                  size={180}
                  level="H"
                  includeMargin
                />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">{room}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Laboratory Unit</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" className="flex-1 font-bold h-10" onClick={() => downloadQR(room)}>
                  <Download className="w-4 h-4 mr-2" /> PNG
                </Button>
                <Button variant="outline" size="sm" className="flex-1 font-bold h-10" onClick={() => printQR(room)}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
