import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn  } from "typeorm";

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ type: 'int', default: 0 })
  qty: number;

  @CreateDateColumn()
  createdAt: Date;
}