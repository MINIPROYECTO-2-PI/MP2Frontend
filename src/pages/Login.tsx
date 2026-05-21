import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FcGoogle } from "react-icons/fc";
import { User } from "../services/auth.ts";
export function Login() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Ingresar a tu cuenta</CardTitle>
        <CardDescription>
          Ingresa tu correo para ingresar a tu cuenta
        </CardDescription>
        <CardAction>
          <Button variant="link">Registrarse</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Contraseña</Label>
                <a
                  href="#"
                  className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Olvidaste tu contraseña?
                </a>
              </div>
              <Input id="password" type="password" required />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button type="submit" className="w-full">
          Ingresar
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => User.googleLogin()}
        >
          Ingresar con Google <FcGoogle />
        </Button>
      </CardFooter>
    </Card>
  );
}
export default Login;
