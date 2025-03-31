import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    {
      title: "Kontrol Paneli",
      items: [
        {
          icon: "fas fa-ticket-alt",
          label: "Aktif Ticketlar",
          href: "/"
        },
        {
          icon: "fas fa-chart-line",
          label: "Nitelik İstatistikleri",
          href: "/player-stats"
        },
        {
          icon: "fas fa-running",
          label: "Antrenman Takibi",
          href: "/training"
        },
        {
          icon: "fas fa-cog",
          label: "Ayarlar",
          href: "/settings"
        }
      ]
    },
    {
      title: "Komutlar",
      items: [
        {
          icon: "fas fa-terminal",
          label: "/fixson",
          isBotCommand: true,
          href: "/player-stats"
        },
        {
          icon: "fas fa-redo-alt",
          label: "/fixreset",
          isBotCommand: true,
          href: "/player-stats"
        }
      ]
    }
  ];

  return (
    <div className="w-full md:w-64 bg-discord-dark flex-shrink-0 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-discord-blue flex items-center justify-center">
            <i className="fas fa-ticket-alt text-white"></i>
          </div>
          <h1 className="font-bold text-lg">Ticket Bot</h1>
        </div>
      </div>
      
      <nav className="p-2">
        {navItems.map((section, index) => (
          <div key={index}>
            <h2 className="text-discord-light uppercase text-xs font-bold px-4 py-2 mt-4 first:mt-0">
              {section.title}
            </h2>
            <ul>
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {item.isBotCommand ? (
                    <Link href={item.href}>
                      <a className={cn(
                        "w-full text-left flex items-center space-x-2 p-3 rounded hover:bg-gray-700",
                        location === item.href ? "text-white bg-gray-700" : "text-discord-light"
                      )}>
                        <i className={cn(item.icon, "w-5")}></i>
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  ) : (
                    <Link href={item.href}>
                      <a className={cn(
                        "flex items-center space-x-2 p-3 rounded hover:bg-gray-700",
                        location === item.href ? "text-white bg-gray-700" : "text-discord-light"
                      )}>
                        <i className={cn(item.icon, "w-5")}></i>
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
