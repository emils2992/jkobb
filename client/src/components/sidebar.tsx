import { Link, useLocation, useNavigate } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { LogOut, MoreHorizontal, Bot, Trophy } from "lucide-react"; // Added Bot and Trophy icons
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/routes";

interface NavItem {
  icon: string | JSX.Element; //Modified to accept JSX.Element
  label: string;
  href: string;
  isBotCommand?: boolean;
  hasShortcut?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  const navItems: NavSection[] = [
    {
      title: "Kontrol Paneli",
      items: [
        {
          icon: "fas fa-ticket-alt",
          label: "Aktif Ticketlar",
          href: ROUTES.HOME,
          hasShortcut: true
        },
        {
          icon: "fas fa-chart-line",
          label: "Nitelik İstatistikleri",
          href: ROUTES.PLAYER_STATS,
          hasShortcut: true
        },
        {
          icon: "fas fa-running",
          label: "Antrenman Takibi",
          href: ROUTES.TRAINING,
          hasShortcut: true
        },
        {
          icon: "fas fa-cog",
          label: "Ayarlar",
          href: ROUTES.SETTINGS,
          hasShortcut: true
        },
        {
          icon: "fas fa-comments",
          label: "Admin Sohbet",
          href: ROUTES.ADMIN_CHAT,
          hasShortcut: true
        },
        { // Added Leaderboard item
          icon: <Trophy />,
          label: "Yetkili Sıralaması",
          href: ROUTES.STAFF_LEADERBOARD,
          hasShortcut: true
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
          href: ROUTES.PLAYER_STATS
        },
        {
          icon: "fas fa-redo-alt",
          label: "/fixreset",
          isBotCommand: true,
          href: ROUTES.PLAYER_STATS
        },
        {
          icon: "fas fa-cog",
          label: "/ayarla",
          isBotCommand: true,
          href: ROUTES.SETTINGS
        }
      ]
    },
    {
      title: "AI",
      items: [
        {
          icon: "fas fa-comment",
          label: "AI Asistanı",
          href: ROUTES.AI_CHAT
        }
      ]
    }
  ];

  return (
    <div className="w-full md:w-64 bg-discord-dark flex-shrink-0 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <img src="/assets/logo.png" alt="Epic Lig Logo" className="w-10 h-10" onError={(e) => e.currentTarget.src = "../src/assets/logo.png"} />
          <h1 className="font-bold text-lg">Epic Lig Ticket Panel</h1>
        </div>
      </div>

      <nav className="p-2">
        {navItems.map((section, index) => {
          const sectionItems = section.items;
          const shortcutItems = section.title === "Kontrol Paneli"
            ? section.items.filter(item => item.hasShortcut)
            : [];

          return (
            <div key={index}>
              <div className="flex items-center justify-between px-4 py-2 mt-4 first:mt-0">
                <h2 className="text-discord-light uppercase text-xs font-bold">
                  {section.title}
                </h2>

                {section.title === "Kontrol Paneli" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-gray-700 text-discord-light">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-gray-800 border border-gray-700 text-discord-light">
                      <div className="py-1 px-2 border-b border-gray-700 mb-1 text-xs font-semibold uppercase">
                        Hızlı Erişim
                      </div>
                      {shortcutItems.map((item, hiddenIndex) => (
                        <DropdownMenuItem key={hiddenIndex} className="focus:bg-gray-700 focus:text-white">
                          <Link href={item.href}>
                            <div className="flex items-center space-x-2 w-full text-left py-1">
                              {typeof item.icon === 'string' ? <i className={cn(item.icon, "w-5")}></i> : item.icon}  {/*Conditional rendering for icon type*/}
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <ul>
                {sectionItems.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link href={item.href} onClick={(e) => {
                      // Prevent default to let Wouter handle navigation
                      e.preventDefault();
                      // Use Wouter navigate instead of window.location
                      window.history.pushState(null, '', item.href);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}>
                      <div className={cn(
                        "flex items-center space-x-2 p-3 rounded hover:bg-gray-700 cursor-pointer",
                        location === item.href ? "text-white bg-gray-700" : "text-discord-light",
                        item.isBotCommand ? "w-full text-left" : ""
                      )}>
                        {typeof item.icon === 'string' ? <i className={cn(item.icon, "w-5")}></i> : item.icon} {/*Conditional rendering for icon type*/}
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-2 p-2 rounded bg-discord-darker">
          <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center">
            <i className="fas fa-crown text-yellow-400"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-discord-light">Bot Sahibi</span>
            <span className="text-sm font-medium">emilswd ✨</span>
          </div>
        </div>
      </div>

      <div className="mt-2 p-4 border-t border-gray-800">
        <button
          onClick={() => {
            logout();
            setTimeout(() => {
              window.location.href = ROUTES.LOGIN;
            }, 100);
          }}
          className="w-full flex items-center justify-center space-x-2 p-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}