import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveBar } from '@nivo/bar';
import { useToast } from "@/hooks/use-toast";

interface LiveChartProps {
  title: string;
  dataEndpoint: string;
  refreshInterval?: number; // milisaniye olarak yenileme süresi
  colors?: string[];
}

interface ChartData {
  id: string;
  label: string;
  value: number;
  color?: string;
}

const LiveChart: React.FC<LiveChartProps> = ({ 
  title, 
  dataEndpoint,
  refreshInterval = 10000, // varsayılan olarak 10 saniye
  colors = ['#3eb8df', '#5865F2', '#43B581', '#FAA61A', '#ED4245']
}) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // Error state eklendi
  const { toast } = useToast();

  // Veri yükleme fonksiyonu
  const fetchData = async () => {
    try {
      const response = await fetch(dataEndpoint);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const rawData = await response.json();

      // Veriyi grafik için uygun formata dönüştür - bu kısmı endpoint'e göre değiştirin
      const formattedData = formatDataForChart(rawData);

      setData(formattedData);
      setError(false); // Hata durumunu sıfırla
    } catch (error) {
      console.error('Grafik verisi yüklenirken hata:', error);
      toast({
        title: "Grafik Yükleme Hatası",
        description: "Veriler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        variant: "destructive"
      });
      setError(true); // Hata durumunu ayarla
    } finally {
      setLoading(false);
    }
  };

  // Veriyi grafik formatına dönüştüren yardımcı fonksiyon - ihtiyaca göre düzenleyin
  const formatDataForChart = (rawData: any[]): ChartData[] => {
    // Eğer veri yoksa veya boşsa default veri döndür
    if (!rawData || rawData.length === 0) {
      return generateDemoData();
    }
    // Bu örnek için, API'den dönen veriyi basit bir dizi olarak varsayıyoruz
    // Gerçek uygulamada, kendi veri yapınıza göre bu fonksiyonu değiştirmeniz gerekecek
    return rawData.map((item, index) => ({
      id: item.name || `Item ${index}`,
      label: item.label || item.name || `Item ${index}`,
      value: item.value || 0, // Eğer değer yoksa 0 ata
      color: colors[index % colors.length] // Renkleri dönüşümlü olarak ata
    }));
  };

  const generateDemoData = (): ChartData[] => {
    const demoData: ChartData[] = [];
    for (let i = 0; i < 5; i++) {
      demoData.push({
        id: `Item ${i+1}`,
        label: `Item ${i+1}`,
        value: Math.floor(Math.random() * 100),
        color: colors[i]
      });
    }
    return demoData;
  };

  useEffect(() => {
    // İlk yükleme
    fetchData();

    // Belirtilen aralıklarla verileri yenile
    const intervalId = setInterval(fetchData, refreshInterval);

    // Komponent ayrıldığında interval'ı temizle
    return () => clearInterval(intervalId);
  }, [refreshInterval, dataEndpoint]);

  // Yükleme durumu için animasyonlu iskelet
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="h-6 bg-gray-700 rounded w-1/3"></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-700 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <Card><CardContent>Hata: Veri yüklenirken bir sorun oluştu.</CardContent></Card>;
  }

  return (
    <Card className="shadow-glow overflow-hidden border-gradient">
      <CardHeader className="bg-gradient-to-r from-discord-dark to-[#36393f] pb-2">
        <CardTitle className="text-lg text-white relative z-10">
          <span className="gradient-text">{title}</span>
          <div className="absolute top-0 right-2 h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-64 w-full">
          <ResponsiveBar
            data={data}
            keys={['value']}
            indexBy="id"
            margin={{ top: 50, right: 50, bottom: 50, left: 60 }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={({ id, data }) => data.color || colors[0]}
            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Kategori',
              legendPosition: 'middle',
              legendOffset: 32,
              truncateTickAt: 0
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Değer',
              legendPosition: 'middle',
              legendOffset: -40,
              truncateTickAt: 0
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            animate={true}
            motionStiffness={90}
            motionDamping={15}
            theme={{
              axis: {
                ticks: {
                  text: {
                    fill: '#94a1b2'
                  }
                },
                legend: {
                  text: {
                    fill: '#94a1b2',
                    fontSize: 12
                  }
                }
              },
              grid: {
                line: {
                  stroke: '#2e3440',
                  strokeWidth: 1
                }
              },
              labels: {
                text: {
                  fill: '#ffffff',
                  fontSize: 12,
                  fontWeight: 'bold'
                }
              },
              tooltip: {
                container: {
                  background: '#2e3440',
                  color: '#eceff4',
                  fontSize: 12,
                  borderRadius: 4,
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)'
                }
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveChart;