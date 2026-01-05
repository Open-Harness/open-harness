import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import "./global.css";

const inter = Inter({
	subsets: ["latin"],
});

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="flex flex-col min-h-screen">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					<RootProvider>{children}</RootProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
